export interface HTML2CanvasOptions {
    async?: boolean;
    allowTaint?: boolean;
    backgroundColor?: string;
    canvas?: HTMLCanvasElement;
    foreignObjectRendering?: boolean;
    imageTimeout?: number;
    logging?: boolean;
    proxy?: string;
    removeContainer?: boolean;
    scale?: number;
    useCORS?: boolean;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    scrollX?: number;
    scrollY?: number;
    windowWidth?: number;
}

export interface ShotOptions {
    html2canvasOptions?: HTML2CanvasOptions;
    previewContainer: HTMLElement;
    dialogContainer: HTMLElement;
    ignoreElements?: HTMLElement[];
}

export interface ShotArea {
    x: number;
    y: number;
    width: number;
    height: number;
}
