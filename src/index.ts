import html2canvas from "html2canvas";

export class Shotify {
    init() {
        html2canvas(document.body).then(function(canvas: Node) {
            document.body.appendChild(canvas);
        });
    }
}
