import html2canvas from "html2canvas";
import { HTML2CanvasOptions, ShotOptions, ShotArea } from "./types";

enum AnnotationType {
    Highlight = 0,
    Blackout
}

interface Annotation extends ShotArea {
    type: AnnotationType;
    index: number;
    element: HTMLDivElement;
}

interface ToolbarPosition {
    x: number;
    y: number;
    currTx: string;
    nextTx: string;
    boundary: {
        xNeg: number;
        xPos: number;
        yNeg: number;
        yPos: number;
    };
}

class ShotHelper {
    public container: HTMLDivElement;
    public shots: Annotation[] = [];
    public lastShotId: number = 0;
}

export default class Shotify {
    private area: ShotArea;
    private isDrawing: boolean;
    private isDragging: boolean;
    private isDrawingAllowed: boolean;
    private isDraggingAllowed: boolean;
    private drawingContainer: HTMLCanvasElement;
    private previewContainer: HTMLElement;
    private previewCanvas: HTMLCanvasElement;
    private toolbarPosition: ToolbarPosition;
    private toolbarContainer: HTMLElement;
    private rootContainer: HTMLDivElement;
    private drawingCTX: CanvasRenderingContext2D | null;

    private html2canvasOptions: HTML2CanvasOptions;
    private options: ShotOptions;
    private shotHelper: ShotHelper;

    constructor(options: ShotOptions) {
        this.setOptions(options);
    }

    public init() {
        this.reset();
        this.setIgnoreAttributes();
        this.setupContainers();
        this.setScrollPositions();
        window.addEventListener("scroll", this.setScrollPositions);
        this.prepareShot();
    }

    private setOptions(options: ShotOptions) {
        this.options = options;
        this.html2canvasOptions = {
            allowTaint: true,
            ...(options.html2canvasOptions || {})
        };
    }

    private setupContainers() {
        const rootContainer: HTMLDivElement = document.createElement("div");
        this.rootContainer = rootContainer;

        const shotHelpersContainer: HTMLDivElement = document.createElement("div");
        shotHelpersContainer.style.width = `${document.documentElement.scrollWidth}px`;
        shotHelpersContainer.style.height = `${document.documentElement.scrollHeight}px`;
        this.shotHelper.container = shotHelpersContainer;

        const drawingContainer: HTMLCanvasElement = document.createElement("canvas");
        drawingContainer.width = document.documentElement.scrollWidth;
        drawingContainer.height = document.documentElement.scrollHeight;
        this.drawingContainer = drawingContainer;
        this.drawingCTX = this.drawingContainer.getContext("2d");
        window.addEventListener("resize", this.resizeHelpers);
        this.resetDrawBoard();

        document.body.appendChild(this.rootContainer);
    }

    private setScrollPositions() {
        const x = -document.documentElement.scrollLeft;
        const y = -document.documentElement.scrollTop;
        this.drawingContainer.style.left = `${x}px`;
        this.drawingContainer.style.top = `${y}px`;
        this.shotHelper.container.style.left = `${x}px`;
        this.shotHelper.container.style.top = `${y}px`;
    }

    private resizeHelpers() {
        const height = document.documentElement.scrollHeight;
        const width = document.documentElement.scrollWidth;
        this.drawingContainer.height = height;
        this.drawingContainer.width = width;
        this.shotHelper.container.style.height = `${height}px`;
        this.shotHelper.container.style.width = `${width}px`;
    }

    private resetDrawBoard() {
        if (this.drawingCTX) {
            this.drawingCTX.clearRect(0, 0, this.drawingContainer.width, this.drawingContainer.height);
            this.drawingCTX.fillStyle = "rgba(102,102,102,.5)";
            this.drawingCTX.fillRect(0, 0, this.drawingContainer.width, this.drawingContainer.height);
        }
    }

    private fetchCurrWindowProps() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollX: window.pageXOffset,
            scrollY: window.pageYOffset,
            x: window.pageXOffset,
            y: window.pageYOffset
        };
    }

    private prepareShot() {
        this.html2canvasOptions = {
            ...this.html2canvasOptions,
            ...this.fetchCurrWindowProps()
        };

        html2canvas(document.body, this.html2canvasOptions).then((canvas: HTMLCanvasElement) => {
            this.previewCanvas = canvas;
            this.options.previewContainer.appendChild(canvas);
        });
    }

    private setIgnoreAttributes() {
        const ignoreElements = this.options.ignoreElements || [];
        ignoreElements.forEach((element: HTMLElement) => {
            element.setAttribute("data-html2canvas-ignore", "true");
        });
    }

    private resetArea() {
        this.area = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };
    }

    private resetState() {
        this.isDrawing = false;
        this.isDragging = false;
        this.isDrawingAllowed = false;
        this.isDraggingAllowed = false;
    }

    private reset() {
        this.resetArea();
        this.resetState();
        this.shotHelper = new ShotHelper();
    }
}
