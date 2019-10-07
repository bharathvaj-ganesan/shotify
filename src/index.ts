import html2canvas from "html2canvas";
import { HTML2CanvasOptions, ShotOptions, ShotArea } from "./types";

enum AnnotationType {
    Highlight = 0,
    Blackout
}

interface Annotation extends ShotArea {
    type: AnnotationType;
    id: number;
    element?: HTMLDivElement;
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
    public annotationType: AnnotationType = AnnotationType.Highlight;
    public container: HTMLDivElement;
    public annotations: Annotation[] = [];
    private annotationId: number = 0;

    public createAnnotation(data: ShotArea): Annotation {
        const annotation: Annotation = {
            ...data,
            type: this.annotationType,
            id: this.annotationId++
        };

        if (annotation.width < 0) {
            annotation.x += annotation.width;
            annotation.width *= -1;
        }

        if (annotation.height < 0) {
            annotation.y += annotation.height;
            annotation.height *= -1;
        }

        this.annotations.push(annotation);
        return annotation;
    }
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

    private drawStartListener = (event: MouseEvent) => {
        if (this.isDrawingAllowed) {
            this.isDrawing = true;
            this.area = {
                x: event.clientX + document.documentElement.scrollLeft,
                y: event.clientY + document.documentElement.scrollTop,
                width: 0,
                height: 0
            };
        }
    };

    private drawStopListener = (event: MouseEvent) => {
        if (this.isDrawingAllowed) {
            this.isDrawing = false;

            // TODO: need to check these magic numbers
            if (Math.abs(this.area.width) < 6 || Math.abs(this.area.height) < 6) {
                return;
            }

            const annotation: Annotation = this.annotationHelper.createAnnotation(this.area);
            annotation.element = this.createHelperDiv(annotation);

            this.repaint();
        }
    };

    private drawListener = (event: MouseEvent) => {
        event.preventDefault();
        if (this.isDrawing) {
            this.area.width = event.clientX - this.area.x + document.documentElement.scrollLeft;
            this.area.height = event.clientY - this.area.y + document.documentElement.scrollTop;

            // TODO: constant '4' should be lineWidth - also should be optional
            if (this.area.x + this.area.width > document.documentElement.scrollWidth) {
                this.area.width = document.documentElement.scrollWidth - this.area.x - 4;
            }

            if (this.area.x + this.area.width < 0) {
                this.area.width = -this.area.x + 4;
            }

            if (this.area.y + this.area.height > document.documentElement.scrollHeight) {
                this.area.height = document.documentElement.scrollHeight - this.area.y - 4;
            }

            if (this.area.y + this.area.height < 0) {
                this.area.height = -this.area.y + 4;
            }

            this.resetDrawBoard();
            this.paintHighlightLines();

            if (
                this.annotationHelper.annotationType === AnnotationType.Highlight &&
                Math.abs(this.area.width) > 6 &&
                Math.abs(this.area.height) > 6
            ) {
                this.paintLines(this.area.x, this.area.y, this.area.width, this.area.height);
                this.drawingCTX &&
                    this.drawingCTX.clearRect(this.area.x, this.area.y, this.area.width, this.area.height);
            }

            this.paintArea();
            this.paintArea(AnnotationType.Blackout);

            if (
                this.annotationHelper.annotationType === AnnotationType.Blackout &&
                Math.abs(this.area.width) > 6 &&
                Math.abs(this.area.height) > 6
            ) {
                if (this.drawingCTX) {
                    this.drawingCTX.fillStyle = "rgba(0,0,0,.5)";
                    this.drawingCTX.fillRect(this.area.x, this.area.y, this.area.width, this.area.height);
                }
            }
        }
    };

    private createHelperDiv(data: Annotation): HTMLDivElement {
        const divElem = document.createElement("div");
        divElem.className = this.annotationHelper.annotationType ? "highlight" : "blackout";
        divElem.style.position = "absolute";
        divElem.style.left = `${data.x}px`;
        divElem.style.top = `${data.y}px`;
        divElem.style.width = `${data.width}px`;
        divElem.style.height = `${data.height}px`;
        divElem.style.zIndex = "20";
        divElem.setAttribute("id", `${data.id}`);

        const innerDivElem = document.createElement("div");
        innerDivElem.style.width = `${data.width - 2}px`;
        innerDivElem.style.height = `${data.height - 2}px`;
        innerDivElem.style.margin = "1px";

        const removeButton = document.createElement("button");
        removeButton.innerText = "Remove";
        removeButton.style.position = "absolute";
        removeButton.style.right = removeButton.style.top = "0";
        removeButton.addEventListener("click", event => {
            this.annotationHelper.container.removeChild(divElem);
            this.annotationHelper.annotations.splice(
                this.annotationHelper.annotations.findIndex((annotation: Annotation) => annotation.id === data.id),
                1
            );
            this.repaint();
        });

        divElem.addEventListener("mouseleave", event => {
            if (this.isDrawingAllowed && !this.isDrawing && divElem.hasChildNodes()) {
                let child = divElem.lastElementChild;
                while (child) {
                    divElem.removeChild(child);
                    child = divElem.lastElementChild;
                }
                this.repaint();
            }
        });

        divElem.addEventListener("mouseenter", event => {
            if (this.isDrawingAllowed && !this.isDrawing) {
                divElem.appendChild(innerDivElem);
                divElem.appendChild(removeButton);

                if (data.type === AnnotationType.Blackout) {
                    this.resetDrawBoard();

                    this.paintHighlightLines();
                    this.paintArea();

                    if (this.drawingCTX) {
                        this.drawingCTX.clearRect(data.x, data.y, data.width, data.height);
                        this.drawingCTX.fillStyle = "rgba(0,0,0,.75)";
                        this.drawingCTX.fillRect(data.x, data.y, data.width, data.height);
                        this.annotationHelper.annotations
                            .filter(
                                (annotation: Annotation) =>
                                    annotation.type === AnnotationType.Blackout && annotation.id !== annotation.id
                            )
                            .forEach((annotation: Annotation) => {
                                if (this.drawingCTX) {
                                    this.drawingCTX.fillStyle = "rgba(0,0,0,1)";
                                    this.drawingCTX.fillRect(
                                        annotation.x,
                                        annotation.y,
                                        annotation.width,
                                        annotation.height
                                    );
                                }
                            });
                    }
                }
            }
        });
        return divElem;
    }

    private setScrollPositions = () => {
        const x = -document.documentElement.scrollLeft;
        const y = -document.documentElement.scrollTop;
        this.drawingContainer.style.left = `${x}px`;
        this.drawingContainer.style.top = `${y}px`;
        this.annotationHelper.container.style.left = `${x}px`;
        this.annotationHelper.container.style.top = `${y}px`;
    };

    private resizeHelpers = () => {
        const height = document.documentElement.scrollHeight;
        const width = document.documentElement.scrollWidth;
        this.drawingContainer.height = height;
        this.drawingContainer.width = width;
        this.annotationHelper.container.style.height = `${height}px`;
        this.annotationHelper.container.style.width = `${width}px`;
        this.repaint();
    };

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

        while (this.options.previewContainer.firstChild) {
            this.options.previewContainer.removeChild(this.options.previewContainer.firstChild);
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

    public destroy = () => {
        this.reset();
        window.removeEventListener("resize", this.resizeHelpers);
        document.removeEventListener("mousedown", this.drawStartListener);
        document.removeEventListener("mouseup", this.drawStopListener);
        document.removeEventListener("mousemove", this.drawListener);
        document.body.removeChild(this.rootContainer);
    };
}
