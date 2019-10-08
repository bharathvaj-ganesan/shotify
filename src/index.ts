import html2canvas from "html2canvas";
import { HTML2CanvasOptions, ShotOptions, ShotArea } from "./types";

enum AnnotationType {
    Highlight = "highlight",
    Blackout = "blackout"
}

interface Annotation extends ShotArea {
    type: AnnotationType;
    id: number;
    element?: HTMLDivElement;
}

interface ToolbarPosition {
    x: number;
    y: number;
    currTx: string | null;
    nextTx: string | null;
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
    public annotationArea: null | ShotArea;

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
    private draggerTip: HTMLDivElement;
    private previewCanvas: HTMLCanvasElement;
    private toolbarPosition: ToolbarPosition;
    private toolbarContainer: HTMLDivElement;
    private rootContainer: HTMLDivElement;
    private drawingCTX: CanvasRenderingContext2D | null;
    private isProcessing: boolean = false;
    private isAlertInfoShown: boolean = false;

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
        this.attachScrollListener();
        this.prepareShot();
    }

    private attachScrollListener() {
        window.addEventListener("scroll", this.setScrollPositions);
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
        rootContainer.setAttribute('data-shotify', "true");
        this.rootContainer = rootContainer;

        const annotationHelpersContainer: HTMLDivElement = document.createElement("div");
        annotationHelpersContainer.classList.add("cv-preview__helpers");
        annotationHelpersContainer.style.width = `${document.documentElement.scrollWidth}px`;
        annotationHelpersContainer.style.height = `${document.documentElement.scrollHeight}px`;
        this.annotationHelper.container = annotationHelpersContainer;
        rootContainer.appendChild(annotationHelpersContainer);

        const drawingContainer: HTMLCanvasElement = document.createElement("canvas");
        drawingContainer.classList.add("cv-preview__draw-area");
        drawingContainer.width = document.documentElement.scrollWidth;
        drawingContainer.height = document.documentElement.scrollHeight;
        this.drawingContainer = drawingContainer;
        this.drawingCTX = this.drawingContainer.getContext("2d");
        rootContainer.appendChild(drawingContainer);

        drawingContainer.addEventListener("mousedown", this.drawStartListener);

        this.options.previewContainer.addEventListener("click", this.showToolBar);

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
            this.resetArea();
            this.repaint();
        }
    };

    private saveHighlightAnnotation = (event: MouseEvent) => {
        const area = this.annotationHelper.annotationArea;
        if (area) {
            // TODO: need to check these magic numbers
            if (Math.abs(area.width) < 6 || Math.abs(area.height) < 6) {
                return;
            }

            const annotation: Annotation = this.annotationHelper.createAnnotation(area);
            annotation.element = this.createHelperDiv(annotation);
        }
    };

    private highlightAnnotation = (event: MouseEvent) => {
        this.annotationHelper.annotationArea = null;

        // We need the 3rd element in the list.
        if (!this.isDraggingAllowed || this.isDrawing) {
            return;
        }

        const el = document.elementsFromPoint(event.x, event.y)[3];
        if (el) {
            if (["span"].indexOf(el.nodeName.toLowerCase()) === -1) {
                this.repaint();
                this.drawingContainer.style.cursor = "crosshair";
                return;
            }
            this.drawingContainer.style.cursor = "pointer";
            const rect = el.getBoundingClientRect();
            this.annotationHelper.annotationArea = {
                x: rect.left + document.documentElement.scrollLeft,
                y: rect.top + document.documentElement.scrollTop,
                width: rect.width,
                height: rect.height
            };

            this.repaint();
            if (this.annotationHelper.annotationType === AnnotationType.Highlight) {
                if (this.annotationHelper.annotationArea && this.drawingCTX) {
                    this.paintLines(
                        this.annotationHelper.annotationArea.x,
                        this.annotationHelper.annotationArea.y,
                        this.annotationHelper.annotationArea.width,
                        this.annotationHelper.annotationArea.height
                    );
                    this.drawingCTX.clearRect(
                        this.annotationHelper.annotationArea.x,
                        this.annotationHelper.annotationArea.y,
                        this.annotationHelper.annotationArea.width,
                        this.annotationHelper.annotationArea.height
                    );
                }
            }

            this.paintArea();

            if (this.annotationHelper.annotationType === AnnotationType.Blackout && this.drawingCTX) {
                this.drawingCTX.fillStyle = "rgba(0,0,0,.5)";
                this.drawingCTX.fillRect(
                    this.annotationHelper.annotationArea.x,
                    this.annotationHelper.annotationArea.y,
                    this.annotationHelper.annotationArea.width,
                    this.annotationHelper.annotationArea.height
                );
            }

            this.paintArea(AnnotationType.Blackout);
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
        divElem.className = this.annotationHelper.annotationType ? this.options.classes.highlight : this.options.classes.blackout;
        divElem.style.position = "absolute";
        divElem.style.left = `${data.x}px`;
        divElem.style.top = `${data.y}px`;
        divElem.style.width = `${data.width}px`;
        divElem.style.height = `${data.height}px`;
        divElem.style.zIndex = "101";
        divElem.setAttribute("id", `${data.id}`);

        const innerDivElem = document.createElement("div");
        innerDivElem.style.width = `${data.width - 2}px`;
        innerDivElem.style.height = `${data.height - 2}px`;
        innerDivElem.style.margin = "1px";

        const removeElem = document.createElement("div");
        removeElem.className += this.options.classes.remove_action;
        removeElem.innerHTML = `<i class="${this.options.classes.remove_icon}"></i>`
        removeElem.style.position = "absolute";
        removeElem.style.right = removeElem.style.top = "0";
        removeElem.addEventListener("click", event => {
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
                divElem.appendChild(removeElem);

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
        this.annotationHelper.container.appendChild(divElem);
        return divElem;
    }

    private showToolBar = () => {
        this.isDrawingAllowed = true;
        this.drawingContainer.classList.add("active");
        this.toolbarAlertInfo();

        // this.options.dialogContainer.style.display = "none";
        this.updateDrawing(false)
        this.createToolBar();
        this.drawingContainer.style.zIndex = '100';
        document.addEventListener("mousemove", this.highlightAnnotation);
        document.addEventListener("click", this.saveHighlightAnnotation);
    };

    private hideToolBar = () => {
        this.isDrawingAllowed = false;
        this.drawingContainer.classList.remove("active");
        this.rootContainer.removeChild(this.toolbarContainer);
        this.drawingContainer.style.zIndex = 'auto';
        this.updateDrawing(true)
        document.removeEventListener("mousemove", this.highlightAnnotation);
        document.removeEventListener("click", this.saveHighlightAnnotation);
        this.prepareShot();
    };

    private createToolBar() {
        const toolbarElem = document.createElement("div");
        toolbarElem.className = this.options.classes.toolbar;
        toolbarElem.setAttribute('data-shotify', "true");

        const draggerTipElem = document.createElement("div");
        draggerTipElem.className = this.options.classes.grippy;
        draggerTipElem.innerHTML = `<i class="${this.options.classes.grippy_icon}"></i>`

        document.addEventListener("mouseup", this.stopDragToolbar);
        document.addEventListener("mousedown", this.startDragToolbar);

        this.draggerTip = draggerTipElem;
        this.draggerTip.addEventListener("mousemove", this.dragToolbar);
        toolbarElem.appendChild(this.draggerTip);

        const highlightButtonContainer = document.createElement("div");
        highlightButtonContainer.classList.add(this.options.classes.toolbar_action);
        const highlightButton = document.createElement("button");
        highlightButton.type = "button";
        highlightButton.className += this.options.classes.toolbar_action_highlight;
        highlightButton.addEventListener(
            "click",
            () => (this.annotationHelper.annotationType = AnnotationType.Highlight)
        );
        highlightButtonContainer.appendChild(highlightButton);
        toolbarElem.appendChild(highlightButtonContainer);

        const blackoutButtonContainer = document.createElement("div");
        blackoutButtonContainer.classList.add(this.options.classes.toolbar_action);
        const blackoutButton = document.createElement("button");
        blackoutButton.type = "button";
        blackoutButton.className += this.options.classes.toolbar_action_blackout;
        blackoutButton.addEventListener(
            "click",
            () => (this.annotationHelper.annotationType = AnnotationType.Blackout)
        );
        blackoutButtonContainer.appendChild(blackoutButton);
        toolbarElem.appendChild(blackoutButtonContainer);

        const doneButtonContainer = document.createElement("div");
        doneButtonContainer.classList.add(this.options.classes.toolbar_action);
        const doneButton = document.createElement("button");
        doneButton.innerText = "DONE";
        doneButton.type = "button";
        doneButton.className += this.options.classes.toolbar_action_done;
        doneButton.addEventListener("click", this.hideToolBar);
        doneButtonContainer.appendChild(doneButton);
        toolbarElem.appendChild(doneButtonContainer);

        this.toolbarContainer = toolbarElem;
        this.toolbarPosition.currTx = "translate(-50%, -50%)";
        this.rootContainer.appendChild(this.toolbarContainer);
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

        this.repaint(false);
        if (this.previewCanvas) {
            this.options.previewContainer.removeChild(this.previewCanvas);
        }
        this.updateProcessing(true);
        html2canvas(document.body, this.html2canvasOptions)
        .then((canvas: HTMLCanvasElement) => {
            // To prevent lag
            this.annotationHelper.annotations.forEach((annotation: Annotation) => {
                if(annotation.element) {
                    annotation.element.style.zIndex = "auto";
                } 
            })
           setTimeout(() => {
               this.previewCanvas = this.options.previewContainer.appendChild(canvas);
               this.repaint();
               this.updateProcessing();
           }, 500);
        }).catch(() => {
            this.updateProcessing();
            // TODO: emit error event
        });
    }

    private updateDrawing(state: boolean = false, emit: boolean = true) {
        this.emitEvent('drawing', state);
    }

    private updateProcessing(state: boolean = false, emit: boolean = true) {
        this.isProcessing = state;
        emit && this.emitEvent('processing', state);
    }

    private setIgnoreAttributes() {
        const ignoreElements = this.options.ignoreElements || [];
        ignoreElements.forEach((element: HTMLElement) => {
            element.setAttribute("data-html2canvas-ignore", "true");
        });
    }


    private emitEvent(eventType: string, payload?: any) {
        if (typeof this.options.update === 'function') {
            this.options.update(eventType, payload)
        }
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
        this.updateProcessing(false, false);
        this.toolbarPosition = {
            x: 0,
            y: 0,
            currTx: null,
            nextTx: null,
            boundary: {
                xNeg: 0,
                xPos: 0,
                yNeg: 0,
                yPos: 0
            }
        };
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

    private toolbarAlertInfo() {
        if (this.isAlertInfoShown) {
            return;
        }
        this.isAlertInfoShown = true;
        const alertInfoElem = document.createElement('div');
        alertInfoElem.className += this.options.classes.alert;
        alertInfoElem.setAttribute("data-html2canvas-ignore", "true");
        alertInfoElem.innerText = 'Draw using yellow to highlight issues or black to hide sensitive info';
        this.rootContainer.appendChild(alertInfoElem);

        setTimeout(() => {
            this.rootContainer.removeChild(alertInfoElem);
        }, 3000)
            
    }

    private paintArea(annotationType: AnnotationType = AnnotationType.Highlight) {
        if (annotationType === AnnotationType.Highlight) {
            this.annotationHelper.annotations.forEach((annotation: Annotation) => {
                const { x, y, width, height } = annotation;
                if (annotation.type === AnnotationType.Highlight) {
                    this.drawingCTX && this.drawingCTX.clearRect(x, y, width, height);
                }
            });
        } else {
            this.annotationHelper.annotations.forEach((annotation: Annotation) => {
                const { x, y, width, height } = annotation;
                if (annotation.type === AnnotationType.Blackout) {
                    if (this.drawingCTX) {
                        this.drawingCTX.fillStyle = "rgba(0,0,0,1)";
                        this.drawingCTX.fillRect(x, y, width, height);
                    }
                }
            });
        }
    }

    private startDragToolbar = (event: MouseEvent) => {
        if (!this.isDragging) {
            this.isDragging = true;
            this.toolbarPosition.x = event.clientX;
            this.toolbarPosition.y = event.clientY;

            const rect = this.toolbarContainer.getBoundingClientRect();
            this.toolbarPosition.boundary.xNeg = -rect.left;
            this.toolbarPosition.boundary.xPos = document.documentElement.clientWidth - rect.right;
            this.toolbarPosition.boundary.yNeg = -rect.top;
            this.toolbarPosition.boundary.yPos = document.documentElement.clientHeight - rect.bottom;
        }
    };

    private dragToolbar = (event: MouseEvent) => {
        if (this.isDragging) {
            event.preventDefault();

            let nextX = event.clientX - this.toolbarPosition.x;
            let nextY = event.clientY - this.toolbarPosition.y;

            if (nextX < this.toolbarPosition.boundary.xNeg) {
                nextX = this.toolbarPosition.boundary.xNeg;
            }

            if (nextX > this.toolbarPosition.boundary.xPos) {
                nextX = this.toolbarPosition.boundary.xPos;
            }

            if (nextY < this.toolbarPosition.boundary.yNeg) {
                nextY = this.toolbarPosition.boundary.yNeg;
            }

            if (nextY > this.toolbarPosition.boundary.yPos) {
                nextY = this.toolbarPosition.boundary.yPos;
            }

            nextX = Math.round(nextX);
            nextY = Math.round(nextY);

            this.toolbarPosition.nextTx = `translate(${nextX}px, ${nextY}px)`;
            this.toolbarContainer.style.transform = `${this.toolbarPosition.currTx} ${this.toolbarPosition.nextTx}`;
            this.isDraggingAllowed = true;
        }
    };

    private stopDragToolbar = (event: MouseEvent) => {
        this.isDragging = false;
        if (this.isDraggingAllowed) {
            this.toolbarPosition.currTx = `${this.toolbarPosition.currTx} ${this.toolbarPosition.nextTx}`;
            this.isDraggingAllowed = false;
        }
    };

    public destroy = () => {
        this.reset();
        window.removeEventListener("resize", this.resizeHelpers);
        this.drawingContainer.removeEventListener("mousedown", this.drawStartListener);
        document.removeEventListener("mouseup", this.drawStopListener);
        document.removeEventListener("mousemove", this.drawListener);
        document.removeEventListener("mousemove", this.highlightAnnotation);
        document.removeEventListener("click", this.saveHighlightAnnotation);
        this.draggerTip.removeEventListener("mousemove", this.dragToolbar);
        document.removeEventListener("mouseup", this.stopDragToolbar);
        document.removeEventListener("mousedown", this.startDragToolbar);
        document.body.removeChild(this.rootContainer);
    };
}
