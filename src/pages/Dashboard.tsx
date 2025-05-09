import React, { useEffect } from 'react';
import html2canvas from 'html2canvas';
import { useGithub } from '../hooks/useGithub';
import { SearchBar } from '../components/SearchBar';
import { GithubCard } from '../components/GithubCard';
import { DetailedStats } from '../components/DetailedStats';
import { Download } from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';

interface DashboardProps {
  initialUsername?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ initialUsername = '' }) => {
  const {
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
  } = useGithub();

  const { theme } = useTheme();

  useEffect(() => {
    if (initialUsername) {
      setUsername(initialUsername);
      fetchGitHubData();
    }
  }, [initialUsername]);

  const exportAsImage = async () => {
    const card = document.getElementById('github-card');
    if (card) {
      const clone = card.cloneNode(true) as HTMLElement;
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = card.offsetWidth + 'px';
      clone.style.height = card.offsetHeight + 'px';
      document.body.appendChild(clone);

      try {
        const canvas = await html2canvas(clone, { 
          useCORS: true,
          backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
          scale: 2,
          logging: false,
          allowTaint: true,
          removeContainer: true,
          onclone: (clonedDoc) => {
            const clonedCard = clonedDoc.getElementById('github-card');
            if (clonedCard) {
              const elements = clonedCard.querySelectorAll('*');
              elements.forEach((el) => {
                const element = el as HTMLElement;
                element.style.backdropFilter = 'none';
                element.style.filter = 'none';
                element.style.opacity = '1';
                element.style.transform = 'none';
                element.style.visibility = 'visible';
              });

              clonedCard.style.background = theme === 'dark' ? '#1F2937' : '#FFFFFF';
              clonedCard.style.boxShadow = 'none';
              
              const borders = clonedCard.querySelectorAll('[class*="border"]');
              borders.forEach((el) => {
                const element = el as HTMLElement;
                element.style.borderColor = theme === 'dark' ? '#374151' : '#E5E7EB';
              });
            }
          }
        });

        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = image;
        link.download = `${username}-github-stats.png`;
        link.click();
      } finally {
        document.body.removeChild(clone);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-2 sm:px-4 lg:px-8 mb-8 sm:mb-12">
      <div className="max-w-7xl mx-auto">
        <SearchBar
          username={username}
          setUsername={setUsername}
          onSearch={fetchGitHubData}
          loading={loading}
          error={error}
        />
        
        {userData && (
          <>
            <div className="mt-4 sm:mt-8">
              <GithubCard
                userData={userData}
                languages={languages}
                repoStats={repoStats}
                contributionStats={contributionStats}
                calculateAccountAge={calculateAccountAge}
              />
            </div>
            <div className="mt-4 sm:mt-8">
              <DetailedStats
                repoStats={repoStats}
                contributionStats={contributionStats}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}; 