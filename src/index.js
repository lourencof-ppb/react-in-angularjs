const React = require("react");
const ReactDOM = require("react-dom");
const isPlainObject = require("lodash/isPlainObject");
const isEqual = require("lodash/isEqual");

function angularize(Component, componentName, angularApp, bindings) {
	bindings = bindings || {};
	
	let renderInfo;
    let transclusion;
    let element;

	if (typeof window === "undefined" || typeof angularApp === "undefined") return;

	angularApp
	.component(componentName, {
		bindings,
		controller: ["$element", function ($element) {
            element = $element;

			if (window.angular) {
				// Add $scope
				this.$scope = window.angular.element($element).scope();

				// Create a map of objects bound by '='
				// For those that exists, use $doCheck to check them using angular.equals and trigger $onChanges
				const previous = {};
				this.$onInit = () => {
					for (let bindingKey of Object.keys(bindings)) {
						if(/^data[A-Z]/.test(bindingKey)) {
							console.warn(`'${bindingKey}' binding for ${componentName} component will be undefined because AngularJS ignores attributes starting with data-`);
						}

						if (bindings[bindingKey] === "=") {
							previous[bindingKey] = window.angular.copy(this[bindingKey]);
						}
					}
				};

				this.$doCheck = () => {
					for (let previousKey of Object.keys(previous)) {
						if (!equals(this[previousKey], previous[previousKey])) {
							this.$onChanges();
							previous[previousKey] = window.angular.copy(this[previousKey]);
							return;
						}
					}
				}
			}

			this.$onChanges = () => {
				renderInfo = _this;
                render();
			};
		}]
	})
	.directive(componentName, function () {
		return {
			restrict: 'EA',
			transclude: true,

			link: function (scope, element, attributes, _, transclude) {
				const children = transclude();
				transclusion = createReactElements(children);
				render();

				// as seen in react2angularjs
				function createReactElements(elements) {
					let reactElements = Array.from(elements).reduce(createElement, []);

					//If there is only one Child, react expect children object instead of Array
					if (reactElements.length === 1) {
						return reactElements[0];
					}

					if (reactElements.length === 0) {
						return undefined;
					}

					return reactElements;
				}
				// as seen in react2angularjs
				function findReactComponent(el) {
					let key = Object.keys(el).find(key =>
						key.startsWith('__reactInternalInstance$')
					);

					if (el[key]) {
						let fiberNode = el[key];
						return fiberNode && fiberNode.return; //fiberNode.return && fiberNode.return.stateNode;
					}

					return null;
				}
				// as seen in react2angularjs
				function createElement(elements, element, index) {
					if (element instanceof HTMLElement) {
						let existing = findReactComponent(element);

						if (!existing) {
							let reactElement = createHTMLElement(element, index);
							elements.push(reactElement);
						}

					} else if (element.nodeName === '#text') {
						let reactElement = createTextElement(element);
						//replace new line characters with empty space
						let textContent = reactElement.replace(/âµ/, '');

						//Add only if element contains text content
						if (textContent) {
							elements.push(reactElement);
						}
					}

					return elements;
				}
				// as seen in react2angularjs
				function createHTMLElement(element, index) {
					let { tagName, childNodes } = element;
					let tagname = tagName.toLowerCase();
					let attributes = getAttributesMap(element);

					attributes.key = index;
					attributes.className = attributes.class;
					delete attributes.class;

					if (childNodes.length > 0) {
						attributes.children = createReactElements(childNodes);
					}

					return React.createElement(tagname, attributes);
				}
				// as seen in react2angularjs
				function createTextElement(element) {
					return element.data.trim();
				}
				// as seen in react2angularjs
				function getAttributesMap(element) {
					let { attributes } = element;
					let attrArray = Array.from(attributes || []);

					return attrArray.reduce((map, attr) => {
						map[attr.name] = attr.value;
						return map;
					}, {});
				}
			}
		}
	});

	function render() {
        ReactDOM.render(React.createElement(Component, renderInfo, transclusion), element[0])
    }
}

function angularizeDirective(Component, directiveName, angularApp, bindings) {
	bindings = bindings || {};
	if (typeof window === "undefined" || typeof angularApp === "undefined") return;

	angularApp.directive(directiveName, function () {
		return {
			scope: bindings,
			replace: true,
			link: function (scope, element) {
				// Add $scope
				scope.$scope = scope;

				// First render - needed?
				ReactDOM.render(React.createElement(Component, scope), element[0]);

				// Watch for any changes in bindings, then rerender
				const keys = [];
				for (let bindingKey of Object.keys(bindings)) {
					if(/^data[A-Z]/.test(bindingKey)) {
						console.warn(`'${bindingKey}' binding for ${directiveName} directive will be undefined because AngularJS ignores attributes starting with data-`);
					}
					if (bindings[bindingKey] !== "&") {
						keys.push(bindingKey);
					}
				}

				scope.$watchGroup(keys, () => {
					ReactDOM.render(React.createElement(Component, scope), element[0]);
				});
			}
		}
	});
}

function getService(serviceName) {
	if (typeof window === "undefined" || typeof window.angular === "undefined") return {};
	return window.angular.element(document.body).injector().get(serviceName);
}

function equals(o1, o2) {
	// Compare plain objects without equality check that angular.equals does
	if (isPlainObject(o1) && isPlainObject(o2)) {
		return isEqual(o1, o2);
	}
	return window.angular.equals(o1, o2)
}

module.exports = {
	getService,
	angularize,
	angularizeDirective
};
