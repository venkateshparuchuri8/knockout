(function () {

if (window) {
    // Detect Opera version because Opera 10 doesn't fully support the input event
    var operaVersion = window.opera && window.opera.version && parseInt(window.opera.version());

    var safariVersion = window.navigator.userAgent.match(/^(?:(?!chrome).)*version\/(.*) safari/i);
    if (safariVersion) {
        safariVersion = parseInt(safariVersion[1]);
    }
}

// IE 8 and 9 have bugs that prevent the normal events from firing when the value changes.
// But it does fires the selectionchange event on many of those, presumably because the
// cursor is moving and that counts as the selection changing. The selectionchange event is
// fired at the document level only and doesn't directly indicate which element changed. We
// set up just one event handler for the document and use activeElement to determine which
// element was changed.
if (ko.utils.ieVersion < 10) {
    var selectionChangeRegisteredName = ko.utils.domData.nextKey(),
        selectionChangeHandlerName = ko.utils.domData.nextKey();
    var selectionChangeHandler = function(event) {
        var target = this.activeElement,
            handler = target && ko.utils.domData.get(target, selectionChangeHandlerName);
        if (handler) {
            handler(event);
        }
    };
    var registerForSelectionChangeEvent = function (element, handler) {
        var ownerDoc = element.ownerDocument;
        if (!ko.utils.domData.get(ownerDoc, selectionChangeRegisteredName)) {
            ko.utils.domData.set(ownerDoc, selectionChangeRegisteredName, true);
            ko.utils.registerEventHandler(ownerDoc, 'selectionchange', selectionChangeHandler);
        }
        ko.utils.domData.set(element, selectionChangeHandlerName, handler);
    };
}

ko.bindingHandlers['textInput'] = {
    'init': function (element, valueAccessor, allBindings) {

        var previousElementValue = element.value,
            timeoutHandle,
            elementValueBeforeEvent;

        var updateModel = function () {
            clearTimeout(timeoutHandle);
            elementValueBeforeEvent = timeoutHandle = undefined;

            var elementValue = element.value;
            if (previousElementValue !== elementValue) {
                previousElementValue = elementValue;
                ko.expressionRewriting.writeValueToProperty(valueAccessor(), allBindings, 'textInput', elementValue);
            }
        };

        var deferUpdateModel = function () {
            if (!timeoutHandle) {
                elementValueBeforeEvent = element.value;
                timeoutHandle = setTimeout(updateModel, 4);
            }
        };

        var updateView = function () {
            var modelValue = ko.utils.unwrapObservable(valueAccessor());

            if (modelValue === null || modelValue === undefined) {
                modelValue = '';
            }

            if (elementValueBeforeEvent !== undefined && modelValue === elementValueBeforeEvent) {
                setTimeout(updateView, 4);
                return;
            }

            // Update the element only if the element and model are different. On some browsers, updating the value
            // will move the cursor to the end of the input, which would be bad while the user is typing.
            if (element.value !== modelValue) {
                previousElementValue = modelValue;  // Make sure we ignore events (propertychange) that result from updating the value

                element.value = modelValue;
            }
        };

        var onEvent = function (event, handler) {
            ko.utils.registerEventHandler(element, event, handler);
        };

        if (ko.utils.ieVersion < 9) {
            // Internet Explorer <=8 doesn't support the 'input' event, but does include 'propertychange' that fires whenever
            // any property of an element changes. Unlike 'input', it also fires if a property is changed from JavaScript code,
            // but that's an acceptable compromise for this binding.
            onEvent('propertychange', function(event) {
                if (event.propertyName === 'value') {
                    updateModel();
                }
            });

            if (ko.utils.ieVersion == 8) {
                // IE 8 has a bug where it fails to fire 'propertychange' on the first update following a value change from
                // JavaScript code. To fix this, we bind to the following events also.
                onEvent('keyup', updateModel);      // A single keystoke
                onEvent('keydown', updateModel);    // The first character when a key is held down

                registerForSelectionChangeEvent(element, updateModel);  // 'selectionchange' covers cut, paste, drop, delete, etc.
                onEvent('dragend', deferUpdateModel);
            }
        } else {
            // All other supported browsers support the 'input' event, which fires whenver the content of element is changed
            // through the user interface.
            onEvent('input', updateModel);

            if (ko.utils.ieVersion == 9) {
                // Internet Explorer 9 doesn't fire the 'input' event when deleting text, including using
                // the backspace, delete, or ctrl-x keys, clicking the 'x' to clear the input, dragging text
                // out of the field, and cutting or deleting text using the context menu. 'selectionchange'
                // can detect all of those except dragging text out of the field, for which we use 'dragend'.
                registerForSelectionChangeEvent(element, updateModel);
                onEvent('dragend', deferUpdateModel);
            } else if (safariVersion < 5 && ko.utils.tagNameLower(element) === "textarea") {
                // Safari <5 doesn't fire the 'input' event for <textarea> elements, but it does fire
                // 'textInput'.
                onEvent('textInput', updateModel);
            } else if (operaVersion < 11) {
                // Opera 10 doesn�t fire the 'input' event for cut, paste, undo & drop operations on <input>
                // elements. We can try to catch some of those using 'keydown'.
                onEvent('keydown', deferUpdateModel);
            }
        }

        // Bind to the change event so that we can catch programmatic updates of the value that fire this event.
        onEvent('change', updateModel);

        ko.computed(updateView, null, { disposeWhenNodeIsRemoved: element });
    }
};
ko.expressionRewriting.twoWayBindings['textInput'] = true;

// textinput is an alias textInput
ko.bindingHandlers['textinput'] = {
    // preprocess is the only way to set up a full alias
    preprocess: function (value, name, addBinding) {
        addBinding('textInput', value);
    }
};

})();