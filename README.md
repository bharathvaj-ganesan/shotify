# Shotify

This library helps you build a feedback form similar to [Google](https://www.google.com/tools/feedback/intl/en/learnmore.html). 

## Working

This library uses [html2canvas](https://html2canvas.hertzen.com/) built by [Niklas von Hertzen himself. The entire screenshot is created on the client side using vanilla Javascript.
The rendered image may not be 100% accurate but should be fine for sending feedback.

## Installation

> Supports almost all ECMAScript 5 compliant browsers.

### CDN


### NPM


## API

### Usage

```js
  import Shotify from 'shotify';

  const shotify = new Shotify({
    previewContainer: this.$refs.previewContainer as HTMLElement
  });
  shotify.init();

```

### Options

Below are the options you can pass during booting up of Shotify.

**Option**|**Type**|**Required**|**Description**
-----|-----|-----|-----
previewContainer|HTMLDivElement| Yes | HTML Div element that act has placeholder for preview canvas 
dialogContainer|HTMLElement| No | Modal container that holds your feedback form
update|Function | No | Callback event listeners
classes|Object | No | Class names to be applied for elements controlled by shotify
html2canvasOptions| Object | No | html2canvas library options


#### Classes

Below are the classes that points maps to the UI elements controlled by Shotify

  * **highlight** - Highlighted sections
  * **blackout** - Blackouted sections
  * **toolbar** - Wrapper class for toolbar containing highlight and blackout options
  * **toolbar_action** - Wrapper class for actions used inside toolbar
  * **toolbar_action_highlight** - Highlight toolbar action class
  * **toolbar_action_blackout** - Blackout toolbar action class
  * **toolbar_action_done** - Done toolbar action class
  * **grippy** - Class used for grippy section of the toolbar
  * **grippy_icon** - Grippy icon for the toolbar
  * **remove_action** - Wrapper class for remove action
  * **remove_icon** - Class for remove icon of the user marked sections
  * **alert** - Alert Info class used for showing toolbar alert message


#### Events

Below are the events that are emitted during the life cycle of the Shotify

* **processing**
  - Shotify is preparing the feedback screenshot
  - You can use this event to show loaders as this may take a while. Depends on the complexity of the page
* **drawing**
  - User has selected to highlight/blackout areas of the page
  - You can use this event to hide the feedback modal for example.
* **processed**
  - Feedback image is ready to be used.
  - You can use the payload image data being passed to be sent to the server.

### Methods

* init()

  Mounts the Shotify. Shotify will create DOMs needed to capture the user feedback screenshot.

* destroy()

  Will destroy Shotify instance. Though modern browsers will remove listeners attached to deleted DOMs it is a best practice to call this method when your feedback component is being destroyed so that there is no memory leak


## TypeScript

Shotify includes [Typescript](http://typescriptlang.org/) definitions.

## Credits

Inspired by [Niklas von Hertzen](https://experiments.hertzen.com/jsfeedback/)


## License

MIT © [Bharathvaj Ganesan](https://github.com/bharathvaj1995)