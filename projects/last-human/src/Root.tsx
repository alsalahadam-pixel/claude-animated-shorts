import React from "react";
import { Composition } from "remotion";
import { Test } from "./Test";
import { CharSheet } from "./CharSheet";
import { CharRef } from "./CharRef";
import { LastHuman, LAST_HUMAN_FRAMES, Photo, FinalPlate, FinalOverlay, FinalPreview, FINAL_FRAMES, Part2Plate, Part2Overlay, Part2Preview, Part2Cover, P2_FRAMES, Part3Plate, Part3Overlay, Part3Preview, Part3FeedSrc, P3_FRAMES } from "./LastHuman";

export const Root: React.FC = () => (
  <>
    <Composition id="LastHuman" component={LastHuman} durationInFrames={LAST_HUMAN_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="FinalPlate" component={FinalPlate} durationInFrames={FINAL_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="FinalOverlay" component={FinalOverlay} durationInFrames={FINAL_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="FinalPreview" component={FinalPreview} durationInFrames={FINAL_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Part2Plate" component={Part2Plate} durationInFrames={P2_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Part2Overlay" component={Part2Overlay} durationInFrames={P2_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Part2Preview" component={Part2Preview} durationInFrames={P2_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Part2Cover" component={Part2Cover} durationInFrames={P2_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Part3Plate" component={Part3Plate} durationInFrames={P3_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Part3Overlay" component={Part3Overlay} durationInFrames={P3_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Part3Preview" component={Part3Preview} durationInFrames={P3_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Part3FeedSrc" component={Part3FeedSrc} durationInFrames={1} fps={30} width={1080} height={1440} />
    <Composition id="Photo" component={Photo} durationInFrames={1} fps={30} width={1080} height={1440} />
    <Composition id="Test" component={Test} durationInFrames={60} fps={30} width={1080} height={1920} />
    <Composition id="CharRef" component={CharRef} durationInFrames={1} fps={30} width={2160} height={2700} defaultProps={{ part: "hero" as const }} />
    <Composition id="EntityRef" component={CharRef} durationInFrames={1} fps={30} width={2160} height={2700} defaultProps={{ part: "entity" as const }} />
    <Composition id="SleeperRef" component={CharRef} durationInFrames={1} fps={30} width={2160} height={2700} defaultProps={{ part: "sleeper" as const }} />
    <Composition id="CharSheet" component={CharSheet} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);
