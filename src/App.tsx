import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar, WindowControls } from "@/components/TitleBar";
import { NodeTest } from "@/components/pages/NodeTest";
import { Settings } from "@/components/pages/Settings";
import { getStoredUser, type StoredUser } from "@/services/api";
import { useAppTheme } from "@/components/App/hooks/useAppTheme";
import { useTitleBar } from "@/components/App/hooks/useTitleBar";
import { useBackground } from "@/components/App/hooks/useBackground";
import { BackgroundLayer } from "@/components/App/components/BackgroundLayer";
import { getInitialSidebarMode, type SidebarMode } from "@/lib/settings-utils";

function App() {
  const [activeTab, setActiveTab] = useState("node-test");
  const [user, setUser] = useState<StoredUser | null>(() => getStoredUser());
  const initialSidebarMode = getInitialSidebarMode();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    initialSidebarMode !== "classic",
  );
  const [isTesting, setIsTesting] = useState(false);
  const isMacOS =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const isWindows =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("WIN") >= 0;

  useAppTheme();
  const { showTitleBar } = useTitleBar();

  const shouldShowTitleBar = isMacOS
    ? showTitleBar
    : isWindows
      ? showTitleBar
      : true;
  const isTitleBarHidden = (isMacOS || isWindows) && !showTitleBar;
  const shouldPadTop = shouldShowTitleBar || (isWindows && !showTitleBar);
  const SIDEBAR_LEFT = isMacOS && !showTitleBar ? 10 : 15;
  const SIDEBAR_COLLAPSED_WIDTH = Math.round(((20 * 5) / 3) * 2);
  const appContainerRef = useRef<HTMLDivElement>(null);
  const {
    backgroundImage,
    imageSrc,
    overlayOpacity,
    blur,
    effectType,
    videoLoadError,
    videoRef,
    videoStartSound,
    videoVolume,
    videoSrc,
    backgroundType,
    getBackgroundColorWithOpacity,
  } = useBackground();

  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() =>
    initialSidebarMode,
  );

  const handleTestingChange = useCallback((testing: boolean) => {
    setIsTesting(testing);
  }, []);

  useEffect(() => {
    const handleSidebarModeChange = () => {
      const nextMode = getInitialSidebarMode();
      setSidebarMode(nextMode);
      setSidebarCollapsed(nextMode !== "classic");
    };
    window.addEventListener("sidebarModeChanged", handleSidebarModeChange);
    return () =>
      window.removeEventListener("sidebarModeChanged", handleSidebarModeChange);
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const content = useMemo(() => {
    switch (activeTab) {
      case "node-test":
        return <NodeTest user={user} onTestingChange={handleTestingChange} />;
      case "settings":
        return <Settings />;
      default:
        return <NodeTest user={user} onTestingChange={handleTestingChange} />;
    }
  }, [activeTab, user, handleTestingChange]);

  const backgroundStyle = useMemo(() => {
    if (!backgroundImage) {
      return { backgroundColor: getBackgroundColorWithOpacity(100) };
    }
    return {};
  }, [backgroundImage, getBackgroundColorWithOpacity]);

  const handleVideoError = () => {};

  const handleVideoLoadedData = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.volume = videoVolume / 100;
      videoRef.current.play().catch(() => {});
    }
  }, [videoRef, videoVolume]);

  return (
    <>
      <div
        ref={appContainerRef}
        className={`flex flex-col h-screen w-screen overflow-hidden text-foreground ${
          backgroundImage && effectType === "frosted"
            ? "frosted-glass-enabled"
            : ""
        } ${
          backgroundImage && effectType === "translucent"
            ? "translucent-enabled"
            : ""
        }`}
        style={{
          ...backgroundStyle,
          borderRadius: "0",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <BackgroundLayer
          backgroundImage={backgroundImage}
          imageSrc={imageSrc}
          backgroundType={backgroundType}
          videoSrc={videoSrc}
          videoLoadError={videoLoadError}
          videoRef={videoRef}
          videoStartSound={videoStartSound}
          overlayOpacity={overlayOpacity}
          blur={blur}
          getBackgroundColorWithOpacity={getBackgroundColorWithOpacity}
          appContainerRef={appContainerRef}
          onVideoError={handleVideoError}
          onVideoLoadedData={handleVideoLoadedData}
        />
        {shouldShowTitleBar && (
          <div className="relative z-50">
            <TitleBar />
          </div>
        )}
        {isWindows && !showTitleBar ? (
          <div
            data-tauri-drag-region
            className="absolute top-0 right-0 left-0 z-50 h-9 flex items-center justify-end pr-2"
          >
            <WindowControls />
          </div>
        ) : null}
        {sidebarMode === "floating" || sidebarMode === "floating_fixed" ? (
          <>
            <div
              className="absolute z-50"
              style={{
                left: `${SIDEBAR_LEFT}px`,
                top: isTitleBarHidden
                  ? isMacOS
                    ? "10px"
                    : "12px"
                  : "48px",
                bottom: "12px",
              }}
            >
              <Sidebar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                user={user}
                onUserChange={setUser}
                collapsed={sidebarCollapsed}
                onCollapseChange={setSidebarCollapsed}
                collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
                mode={sidebarMode}
                disabled={isTesting}
              />
            </div>

            <div
              className="absolute z-40 overflow-hidden rounded-b-[12px]"
              style={{
                left: `${SIDEBAR_LEFT + SIDEBAR_COLLAPSED_WIDTH}px`,
                right: "0",
                top: shouldPadTop ? "36px" : "0",
                bottom: "0",
              }}
            >
              {isMacOS && !showTitleBar ? (
                <div
                  data-tauri-drag-region
                  className="absolute top-0 left-0 right-0 h-8 z-10"
                />
              ) : null}
              <div className="h-full overflow-auto px-6 pt-4 pb-6 md:px-8 md:pt-6 md:pb-8">
                <div className="max-w-6xl mx-auto w-full h-full">
                  <div className="h-full flex flex-col">{content}</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="relative flex flex-1 overflow-hidden">
            <Sidebar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              user={user}
              onUserChange={setUser}
              mode="classic"
              disabled={isTesting}
            />
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {isMacOS && !showTitleBar ? (
                <div
                  data-tauri-drag-region
                  className="h-8 flex-shrink-0 w-full"
                />
              ) : null}
              <div
                className={`flex-1 overflow-auto px-6 pb-6 md:px-8 md:pb-8 ${shouldPadTop ? "pt-4 md:pt-6" : "pt-0"}`}
              >
                <div className="max-w-6xl mx-auto w-full h-full">
                  <div className="h-full flex flex-col">{content}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
