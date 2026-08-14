'use client';

import InputArea from './InputArea';
import { useSettings } from '@/lib/settings';

interface WelcomeScreenProps {
  onSend: (text: string, options?: { skillPrompt?: string; skillName?: string }) => void;
  username?: string;
  activeAgent: string;
  onAgentChange: (agent: string) => void;
}

export default function WelcomeScreen({ onSend, username = 'Yuheng', activeAgent, onAgentChange }: WelcomeScreenProps) {
  const { t } = useSettings();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t('welcome.greeting.night');
    if (hour < 12) return t('welcome.greeting.morning');
    if (hour < 18) return t('welcome.greeting.afternoon');
    return t('welcome.greeting.evening');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center mb-12">
        <h1 className="text-5xl font-medium text-text-primary mb-2">
          {getGreeting()}, {username}
        </h1>
        <h2 className="text-5xl font-medium text-accent">
          {t('welcome.subtitle')}
        </h2>
      </div>
      <div className="max-w-2xl w-full">
        <InputArea onSend={onSend} activeAgent={activeAgent} onAgentChange={onAgentChange} />
      </div>
    </div>
  );
}
