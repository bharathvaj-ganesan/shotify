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

class AnnotationHelper {
    public container: HTMLDivElement;
    public annotations: Annotation[] = [];
    public annotationId: number = 0;
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
    private annotationHelper: AnnotationHelper;

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

        const annotationHelpersContainer: HTMLDivElement = document.createElement("div");
        annotationHelpersContainer.style.width = `${document.documentElement.scrollWidth}px`;
        annotationHelpersContainer.style.height = `${document.documentElement.scrollHeight}px`;
        this.annotationHelper.container = annotationHelpersContainer;

        const drawingContainer: HTMLCanvasElement = document.createElement("canvas");
        drawingContainer.width = document.documentElement.scrollWidth;
        drawingContainer.height = document.documentElement.scrollHeight;
        this.drawingContainer = drawingContainer;
        this.drawingCTX = this.drawingContainer.getContext("2d");
        document.addEventListener("mousedown", this.drawStartListener);
        document.addEventListener("mouseup", this.drawStopListener);
        document.addEventListener("mousemove", this.drawListener);
        window.addEventListener("resize", this.resizeHelpers);
        this.resetDrawBoard();

        document.body.appendChild(this.rootContainer);
    }

    private drawStartListener(event: MouseEvent) {
        if (this.isDrawingAllowed) {
            this.isDrawing = true;
            this.area = {
                x: event.clientX + document.documentElement.scrollLeft,
                y: event.clientY + document.documentElement.scrollTop,
                width: 0,
                height: 0
            };
        }
    }

    private drawStopListener(event: MouseEvent) {
        if (this.isDrawingAllowed) {
            this.isDrawing = false;

            // TODO: need to check these magic numbers
            if (Math.abs(this.area.width) < 6 || Math.abs(this.area.height) < 6) {
                return;
            }

            // const annotation: Annotation = {
            //     ...this.area,
            //     highlight: this._state.highlight,
            //     index: this._helperIdx++
            // };

            // if (helper.width < 0) {
            //     helper.startX += helper.width;
            //     helper.width *= -1;
            // }

            // if (helper.height < 0) {
            //     helper.startY += helper.height;
            //     helper.height *= -1;
            // }

            this.resetArea();
            // this._helperElements.push(this._createHelper(helper));
            // this._helpers.push(helper);
            this.repaint();
        }
    }

    private drawListener() {}

    private setScrollPositions() {
        const x = -document.documentElement.scrollLeft;
        const y = -document.documentElement.scrollTop;
        this.drawingContainer.style.left = `${x}px`;
        this.drawingContainer.style.top = `${y}px`;
        this.annotationHelper.container.style.left = `${x}px`;
        this.annotationHelper.container.style.top = `${y}px`;
    }

    private resizeHelpers() {
        const height = document.documentElement.scrollHeight;
        const width = document.documentElement.scrollWidth;
        this.drawingContainer.height = height;
        this.drawingContainer.width = width;
        this.annotationHelper.container.style.height = `${height}px`;
        this.annotationHelper.container.style.width = `${width}px`;
        this.repaint();
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

        while (this.previewContainer.firstChild) {
            this.previewContainer.removeChild(this.previewContainer.firstChild);
        }

        this.repaint(false);
        html2canvas(document.body, this.html2canvasOptions).then((canvas: HTMLCanvasElement) => {
            this.previewCanvas = canvas;
            this.options.previewContainer.appendChild(canvas);
            this.repaint();
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
        this.annotationHelper = new AnnotationHelper();
    }

    private repaint(includeHighlights: boolean = true) {
        this.resetDrawBoard();
        if (includeHighlights) {
            this.paintHighlightLines();
        }
        this.paintArea();
        this.paintArea(AnnotationType.Blackout);
    }

    private paintHighlightLines() {
        this.annotationHelper.annotations.forEach((annotation: Annotation) => {
            if (annotation.type === AnnotationType.Highlight) {
                const { x, y, height, width } = annotation;
                this.paintLines(x, y, width, height);
            }
        });
    }

    private paintLines(x: number, y: number, width: number, height: number) {
        if (this.drawingCTX) {
            this.drawingCTX.strokeStyle = "#ffeb3b";
            this.drawingCTX.lineJoin = "bevel";
            this.drawingCTX.lineWidth = 4;
            this.drawingCTX.strokeRect(x, y, width, height);
            this.drawingCTX.lineWidth = 1;
        }
    }

    private paintArea(annotationType: AnnotationType = AnnotationType.Highlight) {
        this.annotationHelper.annotations.forEach((annotation: Annotation) => {
            const { x, y, width, height } = annotation;
            if (annotation.type === annotationType) {
                this.drawingCTX && this.drawingCTX.clearRect(x, y, width, height);
            } else {
                if (this.drawingCTX) {
                    this.drawingCTX.fillStyle = "rgba(0,0,0,1)";
                    this.drawingCTX.fillRect(x, y, width, height);
                }
            }
        });
    }

    destroy() {
        this.reset();
        window.removeEventListener("resize", this.resizeHelpers);
        document.removeEventListener("mousedown", this.drawStartListener);
        document.removeEventListener("mouseup", this.drawStopListener);
        document.removeEventListener("mousemove", this.drawListener);
        document.body.removeChild(this.rootContainer);
    }
}
