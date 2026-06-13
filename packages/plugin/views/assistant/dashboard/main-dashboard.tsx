import React, { useState, useEffect } from "react";
import { usePlugin } from "../provider";
import { TFile, Notice } from "obsidian";
import { OnboardingWizard } from "./onboarding-wizard";
import { CollapsibleSection } from "./collapsible-section";
import { FloatingActionButton } from "./floating-action-button";
import Chat from "../ai-chat/container";
import { AssistantView as Organizer } from "../organizer/organizer";

type SectionType = "organizer" | "inbox" | "chat";

/**
 * This is the main container merging the top-level features:
 *  - Onboarding
 *  - Collapsible sections (organizer, inbox, chat)
 *  - Floating Action Button for context-aware quick actions
 *  - Basic real-time progress status
 */
export function MainDashboard() {
  const plugin = usePlugin();
  
  // Track whether user finished onboarding
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(
    plugin.settings.hasRunOnboarding ?? false
  );

  // Which sections are currently expanded
  const [expandedSections, setExpandedSections] = useState<SectionType[]>([
    "organizer",
  ]);

  // Example: track the active file to display context
  const [activeFile, setActiveFile] = useState<TFile | null>(null);

  // Load the active file from Obsidian
  useEffect(() => {
    const handleFileOpen = () => {
      setActiveFile(plugin.app.workspace.getActiveFile());
    };
    void handleFileOpen();
    plugin.app.workspace.on("file-open", handleFileOpen);
    return () => {
      plugin.app.workspace.off("file-open", handleFileOpen);
    };
  }, [plugin.app]);

  /** Toggles whether a collapsible section is open */
  const toggleSection = (section: SectionType) => {
    setExpandedSections(prev => {
      if (prev.includes(section)) {
        return prev.filter(s => s !== section);
      } else {
        return [...prev, section];
      }
    });
  };

  // Handle finishing the onboarding wizard
  const handleOnboardingComplete = () => {
    setIsOnboardingComplete(true);
    plugin.settings.hasRunOnboarding = true;
    void plugin.saveSettings();
  };

  // The floating button can provide context-based suggestions
  // E.g. if user is in a "meeting note", show "Enhance Meeting"
  const getFloatingButtonLabel = () => {
    if (!activeFile) return "No File";
    const name = activeFile.basename.toLowerCase();
    if (name.includes("meeting")) return "Enhance Meeting";
    if (name.includes("notes")) return "Organize Note";
    return "Quick Action";
  };

  // Example quick action triggered by the FAB
  const handleFABAction = () => {
    if (!activeFile) {
      new Notice("No active file to operate on!");
      return;
    }
    // Suppose we see "meeting" in the name -> do "enhanceMeeting()"
    if (activeFile.basename.toLowerCase().includes("meeting")) {
      // plugin.enhanceMeetingNote(activeFile);
      new Notice("Meeting note enhanced!");
    } else {
      // Else do a generic action
      // plugin.organizeFile(activeFile);
      new Notice(`Organized: ${activeFile.basename}`);
    }
  };

  // If the user hasn't completed onboarding, show that first
  if (!isOnboardingComplete) {
    return <OnboardingWizard plugin={plugin} onComplete={handleOnboardingComplete} />;
  }

  // Otherwise, render the main "merged" UI
  return (
    <div className="flex flex-col h-full relative p-2">
      {/** Collapsible Sections */}
      <CollapsibleSection
        title="Organizer"
        isOpen={expandedSections.includes("organizer")}
        onToggle={() => toggleSection("organizer")}
      >
        <div className="p-2">
          <Organizer 
            plugin={plugin} 
            leaf={plugin.app.workspace.getMostRecentLeaf()}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Inbox"
        isOpen={expandedSections.includes("inbox")}
        onToggle={() => toggleSection("inbox")}
      >
        <div className="p-2">
          <p>Inbox logs or quick file processing UI here.</p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Chat"
        isOpen={expandedSections.includes("chat")}
        onToggle={() => toggleSection("chat")}
      >
        <div className="p-2">
          <Chat plugin={plugin} apiKey={plugin.getApiKey()} />
        </div>
      </CollapsibleSection>


      {/** 3) A floating action button for context-based "quick actions" */}
      <FloatingActionButton
        label={getFloatingButtonLabel()}
        onClick={handleFABAction}
      />
    </div>
  );
}
