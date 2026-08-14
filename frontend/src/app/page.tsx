'use client';

import WelcomeScreen from '@/components/WelcomeScreen';
import ChatView from '@/components/ChatView';
import { useChatContext } from '@/lib/chat-context';
import { useSettings } from '@/lib/settings';

export default function Home() {
  const { messages, isStreaming, sendMessage, stopStreaming, activeAgent, setActiveAgent } = useChatContext();
  const { user } = useSettings();

  const hasStarted = messages.length > 0;

  return hasStarted ? (
    <ChatView messages={messages} onSend={sendMessage} onStop={stopStreaming} isStreaming={isStreaming} activeAgent={activeAgent} onAgentChange={setActiveAgent} />
  ) : (
    <WelcomeScreen onSend={sendMessage} username={user.name} activeAgent={activeAgent} onAgentChange={setActiveAgent} />
  );
}
