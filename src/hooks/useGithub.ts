import { useState } from 'react';
import axios from 'axios';
import { graphql } from '@octokit/graphql';
import { GitHubUser, LanguageData, RepoStats, ContributionStats } from '../types/github';

export const useGithub = () => {
  const [username, setUsername] = useState('');
  const [userData, setUserData] = useState<GitHubUser | null>(null);
  const [languages, setLanguages] = useState<LanguageData[]>([]);
  const [repoStats, setRepoStats] = useState<RepoStats>({ 
    stars: 0, 
    forks: 0,
    totalCommits: 0,
    pullRequests: { open: 0, closed: 0, merged: 0 },
    issues: { open: 0, closed: 0 },
    mostStarredRepos: []
  });
  const [contributionStats, setContributionStats] = useState<ContributionStats>({
    totalContributions: 0,
    currentStreak: 0,
    maxStreak: 0,
    contributionsLastYear: 0,
    contributionsByDay: {},
    contributionsByMonth: [],
    averageContributionsPerDay: 0,
    mostProductiveDay: { day: '', contributions: 0 }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculateAccountAge = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const years = now.getFullYear() - created.getFullYear();
    const months = now.getMonth() - created.getMonth();
    if (months < 0) {
      return `${years - 1} ans ${12 + months} mois`;
    }
    return `${years} ans ${months} mois`;
  };

  const calculateStreaks = (contributionDays: any[]) => {
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Trier les jours par date (du plus récent au plus ancien)
    const sortedDays = [...contributionDays].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Calculer le streak actuel
    let lastDay: Date | null = null;
    for (let i = 0; i < sortedDays.length; i++) {
      const day = new Date(sortedDays[i].date);
      day.setHours(0, 0, 0, 0);
      
      if (sortedDays[i].contributionCount > 0) {
        if (lastDay === null) {
          // Premier jour avec des contributions
          const diffDays = Math.floor((today.getTime() - day.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 1) {
            currentStreak = 1;
            lastDay = day;
          } else {
            break;
          }
        } else {
          // Vérifier si c'est le jour suivant
          const diffDays = Math.floor((lastDay.getTime() - day.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentStreak++;
            lastDay = day;
          } else {
            break;
          }
        }
      } else {
        break;
      }
    }

    // Calculer le streak maximum
    for (let i = 0; i < sortedDays.length; i++) {
      if (sortedDays[i].contributionCount > 0) {
        tempStreak++;
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }

    return { currentStreak, maxStreak };
  };

  const fetchDetailedContributionData = async (username: string) => {
    try {
      const query = `
        query($username: String!) {
          user(login: $username) {
            contributionsCollection {
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    contributionCount
                    date
                  }
                }
              }
            }
            repositories(first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
              totalCount
              nodes {
                name
                url
                stargazerCount
                forkCount
                languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                  edges {
                    size
                    node {
                      name
                      color
                    }
                  }
                }
              }
            }
            pullRequests(first: 100, states: [OPEN, CLOSED, MERGED]) {
              totalCount
              nodes {
                state
              }
            }
            issues(first: 100, states: [OPEN, CLOSED]) {
              totalCount
              nodes {
                state
              }
            }
          }
        }
      `;

      const response: any = await graphql(query, {
        username,
        headers: {
          authorization: `bearer ${import.meta.env.VITE_GITHUB_TOKEN}`,
        },
      });

      // Calcul des statistiques de base
      const totalStars = response.user.repositories.nodes.reduce(
        (acc: number, repo: any) => acc + repo.stargazerCount,
        0
      );
      const totalForks = response.user.repositories.nodes.reduce(
        (acc: number, repo: any) => acc + repo.forkCount,
        0
      );
      const totalContributions = response.user.contributionsCollection.contributionCalendar.totalContributions;

      // Traitement des contributions par jour et par mois
      const contributionDays = response.user.contributionsCollection.contributionCalendar.weeks
        .flatMap((week: any) => week.contributionDays);

      // Calculer les streaks
      const { currentStreak, maxStreak } = calculateStreaks(contributionDays);

      const contributionsByDay: { [key: string]: number } = {};
      const contributionsByMonth: { [key: string]: number } = {};
      let maxContributions = 0;
      let mostProductiveDay = { day: '', contributions: 0 };

      contributionDays.forEach((day: any) => {
        const date = new Date(day.date);
        const dayKey = date.toLocaleDateString('fr-FR', { weekday: 'long' });
        const monthKey = date.toLocaleDateString('fr-FR', { month: 'long' });
        
        contributionsByDay[dayKey] = (contributionsByDay[dayKey] || 0) + day.contributionCount;
        contributionsByMonth[monthKey] = (contributionsByMonth[monthKey] || 0) + day.contributionCount;

        if (contributionsByDay[dayKey] > maxContributions) {
          maxContributions = contributionsByDay[dayKey];
          mostProductiveDay = { day: dayKey, contributions: maxContributions };
        }
      });

      // Traitement des PR et issues
      const pullRequests = {
        open: 0,
        closed: 0,
        merged: 0
      };
      
      response.user.pullRequests.nodes.forEach((pr: any) => {
        if (pr.state === 'OPEN') pullRequests.open++;
        else if (pr.state === 'CLOSED') pullRequests.closed++;
        else if (pr.state === 'MERGED') pullRequests.merged++;
      });

      const issues = {
        open: response.user.issues.nodes.filter((issue: any) => issue.state === 'OPEN').length,
        closed: response.user.issues.nodes.filter((issue: any) => issue.state === 'CLOSED').length
      };

      // Traitement des repos les plus étoilés
      const mostStarredRepos = response.user.repositories.nodes
        .slice(0, 5)
        .map((repo: any) => ({
          name: repo.name,
          stars: repo.stargazerCount,
          url: repo.url
        }));

      // Mise à jour des statistiques
      setContributionStats(prev => ({
        ...prev,
        totalContributions,
        contributionsLastYear: totalContributions,
        currentStreak,
        maxStreak,
        contributionsByDay,
        contributionsByMonth: Object.entries(contributionsByMonth).map(([month, count]) => ({
          month,
          count
        })),
        averageContributionsPerDay: contributionDays.reduce((acc: number, day: any) => 
          acc + day.contributionCount, 0) / contributionDays.length,
        mostProductiveDay
      }));

      setRepoStats(prev => ({
        ...prev,
        stars: totalStars,
        forks: totalForks,
        pullRequests,
        issues,
        mostStarredRepos
      }));

      // Mise à jour des langages avec leurs couleurs
      const languagesWithColors = response.user.repositories.nodes
        .flatMap((repo: any) => repo.languages.edges)
        .reduce((acc: any, { node, size }: any) => {
          if (!acc[node.name]) {
            acc[node.name] = { value: 0, color: node.color };
          }
          acc[node.name].value += size;
          return acc;
        }, {});

      setLanguages(
        Object.entries(languagesWithColors)
          .map(([name, data]: [string, any]) => ({
            name,
            value: data.value,
            color: data.color
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6)
      );

    } catch (error) {
      console.error('Error fetching detailed contribution data:', error);
    }
  };

  const fetchGitHubData = async () => {
    if (!username) return;

    setLoading(true);
    setError('');
    try {
      const userResponse = await axios.get(
        `https://api.github.com/users/${username}`
      );
      setUserData(userResponse.data);

      await fetchDetailedContributionData(username);
    } catch (err) {
      setError('Utilisateur non trouvé ou erreur de l\'API GitHub');
    }
    setLoading(false);
  };

  return {
    username,
    setUsername,
    userData,
    languages,
    repoStats,
    contributionStats,
    loading,
    error,
    calculateAccountAge,
    fetchGitHubData,
  };
}; 