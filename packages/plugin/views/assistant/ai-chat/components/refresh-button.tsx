import React from "react";
import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  messageId: string;
  onRefresh: (messageId: string) => void;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  messageId,
  onRefresh,
}) => {
  const handleRefresh = () => {
    onRefresh(messageId);
  };

  return (
    <button
      onClick={handleRefresh}
      className="p-0.5 rounded outline-none border-none shadow-none bg-transparent hover:shadow-sm transition-shadow flex items-center justify-center w-5 h-5"
      title="Regenerate response"
    >
      <RefreshCw size={16} className="text-[--text-muted]" />
    </button>
  );
};

