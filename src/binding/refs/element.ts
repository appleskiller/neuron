import { StateObject, INeBindingRef, IBindingRef, INeElement, IElementRef, IUIState } from '../common/interfaces';

export function wrapNeBindingRef<T extends IUIState>(
    bindingRef: INeBindingRef
): IBindingRef<T> {
    return {
        instance: function () {
            return bindingRef.instance();
        },
        setState: function (state: StateObject) {
            bindingRef.setState(state);
            return this;
        },
        children: function () {
            return bindingRef.children();
        },
        appendTo: function (parent: Node) {
            bindingRef.appendTo(parent);
            return this;
        },
        attachTo: function (placeholder: Node) {
            bindingRef.attachTo(placeholder);
            return this;
        },
        hasAttached: function () {
            return bindingRef.attached;
        },
        attach: function () {
            bindingRef.attach();
            return this;
        },
        detach: function () {
            bindingRef.detach();
            return this;
        },
        resize: function () {
            bindingRef.resize();
            return this;
        },
        detectChanges: function () {
            bindingRef.detectChanges();
            return this;
        },
        destroy: function () {
            // 移除事件绑定
            const instance = bindingRef.instance();
            // instance && instance['__emitter'] && instance['__emitter'].off();
            bindingRef.destroy();
        },
        getBoundingClientRect(): ClientRect {
            return bindingRef.getBoundingClientRect();
        },
        element(id: string): Node | HTMLElement | INeElement {
            return bindingRef.getTemplateVarible(id);
        },
    }
}

export function wrapElement2ElementRef(
    customElement: INeElement
): IElementRef {
    const element: IElementRef = {
        hasAttached: function () {
            return customElement.attached;
        },
        attach: function () {
            customElement.attach();
            return this;
        },
        detach: function () {
            customElement.detach();
            return this;
        },
        resize: function () {
            customElement.resize();
            return this;
        },
        detectChanges: function () {
            customElement.detectChanges();
            return this;
        },
        getBoundingClientRect: function() {
            return customElement.getBoundingClientRect();
        }
    }
    return element;
}

export function wrapBindingRef2ElementRef(
    bindingRef: INeBindingRef
): IElementRef {
    const element: IElementRef = {
        hasAttached: function () {
            return bindingRef.attached;
        },
        attach: function () {
            bindingRef.attach();
            return this;
        },
        detach: function () {
            bindingRef.detach();
            return this;
        },
        resize: function () {
            bindingRef.resize();
            return this;
        },
        detectChanges: function () {
            bindingRef.detectChanges();
            return this;
        },
        getBoundingClientRect: function () {
            return bindingRef.getBoundingClientRect();
        }
    }
    return element;
}
