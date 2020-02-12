import { IPopupPanelRef, IPopupOption, PopupPosition, PopupAnimation, PopupMode, TOKENS, IPopupRef, IPopupPanelState } from './interfaces';
import { nativeApi } from '../../binding/common/domapi';
import { StateObject, IElementRef, BindingTemplate, BindingSelector, IUIStateStatic, IUIState, StateChanges, IChangeDetector, IBindingDefinition, IBindingRef } from '../../binding/common/interfaces';
import { Binding, Property, Element, Emitter, Inject } from '../../binding/factory/decorator';
import { bindingFactory } from '../../binding/factory/factory';
import { Animation } from '../animation';
import { BINDING_TOKENS } from '../../binding/factory/injector';
import { IEmitter } from 'neurons-emitter';
import { isBrowser, isDefined, geometry } from 'neurons-utils';
import { getPixel } from 'neurons-dom';

const popupPosition2AnimationType = {
    [PopupPosition.center]: PopupAnimation.scaleUp,
    [PopupPosition.top]: PopupAnimation.slideDown,
    [PopupPosition.bottom]: PopupAnimation.slideUp,
    [PopupPosition.left]: PopupAnimation.slideRight,
    [PopupPosition.right]: PopupAnimation.slideLeft,
    [PopupPosition.topLeft]: PopupAnimation.slideRight,
    [PopupPosition.topRight]: PopupAnimation.slideLeft,
    [PopupPosition.bottomLeft]: PopupAnimation.slideRight,
    [PopupPosition.bottomRight]: PopupAnimation.slideLeft,
}

const defaultPopupPosition = {
    [PopupMode.dropdown]: PopupPosition.bottomLeft,
    [PopupMode.tooltip]: PopupPosition.bottom,
    [PopupMode.sidepanel]: PopupPosition.right,
    [PopupMode.modal]: PopupPosition.center,
}

@Binding({
    selector: 'ne-popup-panel',
    template: `<div
            [class]="{[panelClass]: true, 'ne-popup-panel': true, 'ne-click-shake-up': shakeup}" 
            [style]="getContainerStyles()"
            [popup-mode]="popupMode || ''"
        >
            <div #container [class]="{
                'ne-popup-panel-content': true,
                'ne-animation': animationEnter,
                'ne-animation-fade': true,
                'ne-animation-enter': animationEnter,
                'ne-animation-done': animationDone,
                'ne-animation-fast': animationFast,
                ['ne-animation-' + animationType]: animationType ? true : false,
            }">
                <ne-binding [source]="source" [hostBinding]="binding" [state]="state"/>
            </div>
        </div>
    `,
    style: `
    .ne-popup-panel {
        position: fixed;
        max-width: 100%;
        max-height: 100%;
    }
    .ne-popup-panel .ne-popup-panel-content {
        overflow: hidden;
        box-sizing: border-box;
        border-radius: 4px;
        background-color: #FFFFFF;
        color: rgba(0, 0, 0, 0.8);
        box-shadow: 0 3px 9px rgba(0, 0, 0, 0.24);
        pointer-events: all;
    }
    .ne-popup-panel[popup-mode=sidepanel] {
        width: 100%;
        height: 100%;
    }
    .ne-popup-panel[popup-mode=sidepanel] .ne-popup-panel-content {
        width: 100%;
        height: 100%;
    }
    `
})
export class PopupPanelState<T extends StateObject> implements IUIState, IPopupOption<T> {
    constructor() {

    }
    @Property() panelClass = '';
    @Property() autoClose = true;
    @Property() shakeup = false;
    @Property() source: BindingSelector | BindingTemplate | HTMLElement | IUIStateStatic<T> = null;
    @Property() binding: IBindingDefinition = null;
    @Property() state: T = null;
    @Property() width: number | string = undefined;
    @Property() height: number | string = undefined;
    
    @Property() popupMode: PopupMode = null;
    @Property() position: PopupPosition = null;
    @Property() connectElement?: HTMLElement | MouseEvent = null;
    
    @Property() show?: boolean = false;

    @Element('container') container: HTMLElement;

    @Emitter() hidden: IEmitter<void>;
    
    animationEnter = false;
    animationDone = false;
    animationFast = false;
    relativeTop: string = '';
    relativeLeft: string = '';
    relativeMinWidth: number | string = '';
    relativeWidth: number | string = '';
    relativeMinHeight: number | string = '';
    relativeHeight: number | string = '';
    animationType: string = '';
    
    private _connectPosition: string = 'bottom';
    
    private _cancelAnimation;
    private _scrollListen;
    private _destroyed;
    private _showen = false;

    @Inject(BINDING_TOKENS.ELEMENT_REF) elementRef: IElementRef;
    @Inject(BINDING_TOKENS.CHANGE_DETECTOR) changeDetector: IChangeDetector;

    private _updateAnimationType() {
        const popupMode = this.popupMode || PopupMode.modal;
        let position = this.position ||  defaultPopupPosition[popupMode] || PopupPosition.center;
        const offset = popupMode === PopupMode.modal ? 4 : 0;
        if (popupMode === PopupMode.dropdown) {
            if (this.connectElement && isBrowser) {
                const box = this._getConnectBoundingBox(this.connectElement);
                const left = box.left;
                const top = box.top;
                const width = window.innerWidth;
                const height = window.innerHeight;
                const panelBox = this._getBBox();
                const panelWidth = isDefined(this.width) ? getPixel(this.width, width) : Math.max(panelBox.width, box.width);
                if (position.indexOf('bottom') !== -1) {
                    this._connectPosition = (top + box.height + offset + panelBox.height > height) ? 'top' : 'bottom';
                } else if (position.indexOf('top') !== -1) {
                    this._connectPosition = (top - panelBox.height - offset < 0) ? 'bottom' : 'top';
                }
                if (position === 'left') {
                    this._connectPosition = panelWidth ? 'left' : ((left - panelWidth - offset < 0) ? 'right' : 'left');
                } else if (position === 'right'){
                    this._connectPosition = panelWidth ? 'right' : ((left + box.width + offset + panelWidth > width) ? 'left' : 'right');
                } else if (position === 'center') {
                    this._connectPosition = 'middle';
                }
                if (this._connectPosition === 'top') {
                    this.animationType = PopupAnimation.spreadUp;
                } else if (this._connectPosition === 'bottom') {
                    this.animationType = PopupAnimation.spreadDown;
                } else if (this._connectPosition === 'left') {
                    this.animationType = PopupAnimation.spreadLeft;
                } else if (this._connectPosition === 'right') {
                    this.animationType = PopupAnimation.spreadRight;
                } else if (this._connectPosition === 'middle') {
                    this.animationType = PopupAnimation.spreadMiddle;
                } else {
                    this.animationType = PopupAnimation.spreadDown;
                }
            } else {
                this.animationType = PopupAnimation.spreadDown;
            }
        } else if (popupMode === PopupMode.tooltip) {
            this.animationType = '';
        } else if (popupMode === PopupMode.sidepanel) {
            if (position === 'center') {
                this.animationType = PopupAnimation.slideCenter;
            } else {
                this.animationType = popupPosition2AnimationType[position] || PopupAnimation.slideCenter;
            }
        } else {
            this.animationType = popupPosition2AnimationType[position] || PopupAnimation.scaleUp;
        }
    }
    getContainerStyles() {
        if (!this._showen) return {};
        const popupMode = this.popupMode || PopupMode.modal;
        let position = this.position || defaultPopupPosition[popupMode] || PopupPosition.center;
        if (popupMode === PopupMode.dropdown) {
            return {
                'top': this.relativeTop,
                'left': this.relativeLeft,
                'minWidth': this.relativeMinWidth,
                'width': this.relativeWidth
            };
        } else if (popupMode === PopupMode.tooltip) {
            return {
                'top': this.relativeTop,
                'left': this.relativeLeft,
                'minWidth': this.relativeMinWidth,
                'width': this.relativeWidth
            };
        } else if (popupMode === PopupMode.sidepanel) {
            return {
                'top': this.relativeTop,
                'left': this.relativeLeft,
                'minWidth': this.relativeMinWidth,
                'width': this.relativeWidth,
                'minHeight': this.relativeMinHeight,
                'height': this.relativeHeight,
            };
        } else {
            return {
                'top': this.relativeTop,
                'left': this.relativeLeft,
                'minWidth': this.relativeMinWidth,
                'width': this.relativeWidth,
                'minHeight': this.relativeMinHeight,
                'height': this.relativeHeight,
            };
        }
    }
    onInit() {
        this._scrollListen = nativeApi.onHTMLScroll(() => {
            if (!this._showen) return;
            this._updatePosition();
            this.changeDetector.detectChanges();
        });
    }
    onChanges(changes?: StateChanges) {
        if (this.show) {
            this._show();
        } else {
            this._hide();
        }
    }
    onResize() {
        this._updatePosition();
    }
    onDestroy() {
        this._destroyed = true;
        this._scrollListen && this._scrollListen();
    }
    private _show() {
        if (this._showen) return;
        this._showen = true;
        // 某些需要检测size的子视图会需要在套用animation type之前进行测量。
        this.changeDetector.detectChanges();
        this._updateAnimationType();
        this._updatePosition();

        this._cancelAnimation = Animation.start({
            duration: 180,
            onEnter: () => {
                this.animationEnter = true;
                this.animationDone = true;
                this.changeDetector.detectChanges();
            },
            onDone: () => {
                
            },
        });
    }
    private _hide() {
        this._cancelAnimation && this._cancelAnimation();
        if (!this._showen) return;
        this._cancelAnimation = Animation.start({
            duration: 120,
            onEnter: () => {
                this.animationDone = false;
                this.animationFast = true;
                this.changeDetector.detectChanges();
            },
            onDone: () => {
                this._showen = false;
                this.hidden.emit();
            },
        });
    }
    private _getBBox(): ClientRect {
        return this.elementRef.getBoundingClientRect();
    }
    private _fixPositionFromEnd(position, triggerSize, panelSize, maxSize, offset) {
        let result = position + triggerSize + offset;
        if (result + panelSize > maxSize) {
            // push to other side
            result = Math.max(position - panelSize - offset, 0);
        }
        return result;
    }
    private _fixPositionFromStart(position, triggerSize, panelSize, maxSize, offset) {
        let result = position - panelSize - offset;
        if (result < 0) {
            if (position + triggerSize + panelSize + offset < maxSize) {
                result = Math.min(position + triggerSize + offset, maxSize - panelSize);
            } else {
                result = 0;
            }
        }
        return result;
    }
    private _fixPositionFromCenter(position, triggerSize, panelSize, maxSize) {
        return Math.max(0, Math.min(position - (panelSize - triggerSize) / 2, maxSize - panelSize));
    }
    private _fixPositionFromCenterTop(position, triggerSize, panelSize, maxSize, offset) {
        const result = Math.min(position - (panelSize - triggerSize) / 2, maxSize - panelSize);
        if (result < 0) {
            return this._fixPositionFromEnd(position, triggerSize, panelSize, maxSize, offset);
        }
        if (result + panelSize > maxSize) {
            return this._fixPositionFromStart(position, triggerSize, panelSize, maxSize, offset);
        }
        return result;
    }
    private _updatePosition() {
        const popupMode = this.popupMode || PopupMode.modal;
        const offset = popupMode === PopupMode.modal ? 4 : 0;
        if (popupMode === PopupMode.dropdown) {
            this._updateDropdownPosition();
        } else if (popupMode === PopupMode.tooltip) {
            this._updateTooltipPosition();
        } else if (popupMode === PopupMode.sidepanel) {
            this._updateSidepanelPosition();
        } else {
            this._updateModalPosition();
        }
    }
    private _updateModalPosition() {
        const position = this.position || PopupPosition.center;
        const relativeInfo = this._calcModalRelativePosition(position, this.connectElement, this._connectPosition);
        this.relativeTop = relativeInfo.relativeTop;
        this.relativeLeft = relativeInfo.relativeLeft;
        this.relativeMinWidth = relativeInfo.relativeMinWidth;
        this.relativeWidth = relativeInfo.relativeWidth;
        this.relativeMinHeight = relativeInfo.relativeMinHeight;
        this.relativeHeight = relativeInfo.relativeHeight;
    }
    private _updateSidepanelPosition() {
        const position = this.position || PopupPosition.right;
        const relativeInfo = this._calcSidepanelRelativePosition(position, this.connectElement, this._connectPosition);
        this.relativeTop = relativeInfo.relativeTop;
        this.relativeLeft = relativeInfo.relativeLeft;
        this.relativeMinWidth = relativeInfo.relativeMinWidth;
        this.relativeWidth = relativeInfo.relativeWidth;
        this.relativeMinHeight = relativeInfo.relativeMinHeight;
        this.relativeHeight = relativeInfo.relativeHeight;
    }
    private _updateDropdownPosition() {
        const position = this.position || PopupPosition.bottomLeft;
        if (this.connectElement && isBrowser) {
            const relativeInfo = this._calcDropdownRelativePosition(position, this.connectElement, this._connectPosition);
            this.relativeTop = relativeInfo.relativeTop;
            this.relativeLeft = relativeInfo.relativeLeft;
            this.relativeMinWidth = relativeInfo.relativeMinWidth;
            this.relativeWidth = relativeInfo.relativeWidth;
        } else {
            this.relativeTop = '';
            this.relativeLeft = '';
            this.relativeMinWidth = '';
            this.relativeWidth = '';
        }
    }
    private _updateTooltipPosition() {
        const position = this.position || PopupPosition.bottomLeft;
        if (this.connectElement) {
            const relativeInfo = this._calcTooltipRelativePosition(position, this.connectElement, this._connectPosition);
            this.relativeTop = relativeInfo.relativeTop;
            this.relativeLeft = relativeInfo.relativeLeft;
            this.relativeMinWidth = relativeInfo.relativeMinWidth;
            this.relativeWidth = relativeInfo.relativeWidth;
        } else {
            this.relativeTop = '';
            this.relativeLeft = '';
            this.relativeMinWidth = '';
            this.relativeWidth = '';
        }
    }
    private _getConnectBoundingBox(connectElement: HTMLElement | MouseEvent) {
        if (!connectElement) return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
        if ('nodeType' in connectElement) {
            return (this.connectElement as HTMLElement).getBoundingClientRect();
        } else {
            const e: MouseEvent = this.connectElement as MouseEvent;
            return { left: e.clientX - 12, top: e.clientY - 12, width: 24, height: 24 };
        }
    }
    // 计算相对connectElement的弹出位置，如果指定一侧空间不足则默认推向另外一侧
    private _calcDropdownRelativePosition(position, connectElement: HTMLElement | MouseEvent, connectPosition) {
        const offset = 0;
        const box = this._getConnectBoundingBox(connectElement);
        const width = window.innerWidth;
        const height = window.innerHeight;
        const panelBox = this._getBBox();
        const panelWidth = isDefined(this.width) ? getPixel(this.width, width) : Math.max(panelBox.width, box.width);
        let relativeTop = null, relativeLeft = null, relativeMinWidth = null, relativeWidth = null;
        if (position.indexOf('bottom') !== -1) {
            connectPosition = (box.top + box.height + offset + panelBox.height > height) ? 'top' : 'bottom';
            relativeTop = this._fixPositionFromEnd(box.top, box.height, panelBox.height, height, offset);
            if (position.indexOf('Right') !== -1) {
                relativeLeft = Math.max(0, Math.min(width - panelWidth, box.left + box.width - panelWidth));
            } else if (position.indexOf('Left') !== -1) {
                relativeLeft = Math.max(0, Math.min(box.left, width - panelWidth));
            } else {
                relativeLeft = this._fixPositionFromCenter(box.left, box.width, panelWidth, width);
            }
        } else if (position.indexOf('top') !== -1) {
            connectPosition = (box.top - panelBox.height - offset < 0) ? 'bottom' : 'top';
            relativeTop = this._fixPositionFromStart(box.top, box.height, panelBox.height, height, offset);
            if (position.indexOf('Right') !== -1) {
                relativeLeft = Math.max(0, Math.min(width - panelWidth, box.left + box.width - panelWidth));
            } else if (position.indexOf('Left') !== -1) {
                relativeLeft = Math.max(0, Math.min(box.left, width - panelWidth));
            } else {
                relativeLeft = this._fixPositionFromCenter(box.left, box.width, panelWidth, width);
            }
        }
        if (position === 'left') {
            connectPosition = (box.left - panelWidth - offset) ? 'right' : 'left';
            relativeLeft = this._fixPositionFromStart(box.left, box.width, panelWidth, width, offset);
            relativeTop = this._fixPositionFromCenter(box.top, box.height, panelBox.height, height);
        } else if (position === 'right') {
            connectPosition = (box.left + box.width + offset + panelWidth > width) ? 'left' : 'right';
            relativeLeft = this._fixPositionFromEnd(box.left, box.width, panelWidth, width, offset);
            relativeTop = this._fixPositionFromCenter(box.top, box.height, panelBox.height, height);
        } else if (position === 'center') {
            relativeTop = this._fixPositionFromCenterTop(box.top, box.height, panelBox.height, height, offset);
            relativeLeft = this._fixPositionFromCenter(box.left, box.width, panelWidth, width);
        }
        if (isDefined(this.width)) {
            relativeMinWidth = '';
            relativeWidth = this.width;
        } else {
            relativeMinWidth = (box.width || 0);
            relativeWidth = '';
        }
        return {
            relativeTop: relativeTop === null ? '' : relativeTop + 'px',
            relativeLeft: relativeLeft === null ? '' : relativeLeft + 'px',
            relativeMinWidth: relativeMinWidth,
            relativeWidth: relativeWidth,
        }
    }
    private _calcTooltipRelativePosition(position, connectElement: HTMLElement | MouseEvent, connectPosition) {
        const offset = 0;
        const box = this._getConnectBoundingBox(connectElement);
        const width = window.innerWidth;
        const height = window.innerHeight;
        const panelBox = this._getBBox();
        const panelWidth = isDefined(this.width) ? getPixel(this.width, width) : Math.min(panelBox.width, box.width);
        let relativeTop = null, relativeLeft = null, relativeMinWidth = null, relativeWidth = null;
        if (position.indexOf('bottom') !== -1) {
            connectPosition = (box.top + box.height + offset + panelBox.height > height) ? 'top' : 'bottom';
            relativeTop = this._fixPositionFromEnd(box.top, box.height, panelBox.height, height, offset);
            if (position.indexOf('Right') !== -1) {
                relativeLeft = Math.max(0, Math.min(width - panelWidth, box.left + box.width - panelWidth));
            } else if (position.indexOf('Left') !== -1) {
                relativeLeft = Math.max(0, Math.min(box.left, width - panelWidth));
            } else {
                relativeLeft = this._fixPositionFromCenter(box.left, box.width, panelWidth, width);
            }
        } else if (position.indexOf('top') !== -1) {
            connectPosition = (box.top - panelBox.height - offset < 0) ? 'bottom' : 'top';
            relativeTop = this._fixPositionFromStart(box.top, box.height, panelBox.height, height, offset);
            if (position.indexOf('Right') !== -1) {
                relativeLeft = Math.max(0, Math.min(width - panelWidth, box.left + box.width - panelWidth));
            } else if (position.indexOf('Left') !== -1) {
                relativeLeft = Math.max(0, Math.min(box.left, width - panelWidth));
            } else {
                relativeLeft = this._fixPositionFromCenter(box.left, box.width, panelWidth, width);
            }
        }
        if (position === 'left') {
            connectPosition = (box.left - panelWidth - offset) ? 'right' : 'left';
            relativeLeft = this._fixPositionFromStart(box.left, box.width, panelWidth, width, offset);
            relativeTop = this._fixPositionFromCenter(box.top, box.height, panelBox.height, height);
        } else if (position === 'right') {
            connectPosition = (box.left + box.width + offset + panelWidth > width) ? 'left' : 'right';
            relativeLeft = this._fixPositionFromEnd(box.left, box.width, panelWidth, width, offset);
            relativeTop = this._fixPositionFromCenter(box.top, box.height, panelBox.height, height);
        } else if (position === 'center') {
            relativeTop = this._fixPositionFromCenterTop(box.top, box.height, panelBox.height, height, offset);
            relativeLeft = this._fixPositionFromCenter(box.left, box.width, panelWidth, width);
        }
        if (isDefined(this.width)) {
            relativeMinWidth = '';
            relativeWidth = this.width;
        } else {
            relativeMinWidth = (panelWidth || 0);
            relativeWidth = '';
        }
        return {
            relativeTop: relativeTop === null ? '' : relativeTop + 'px',
            relativeLeft: relativeLeft === null ? '' : relativeLeft + 'px',
            relativeMinWidth: relativeMinWidth,
            relativeWidth: relativeWidth,
        }
    }
    // 计算侧面板的位置，如果不指定宽度或高度，则横向撑满或纵向撑满
    private _calcSidepanelRelativePosition(position, connectElement: HTMLElement | MouseEvent, connectPosition) {
        const offset = 0;
        const box = this._getConnectBoundingBox(connectElement);
        const isWidthDefined = isDefined(this.width);
        const isHeightDefined = isDefined(this.height);
        const panelWidth = isWidthDefined ? getPixel(this.width, box.width) : box.width;
        const panelHeight = isHeightDefined ? getPixel(this.height, box.height) : box.height;
        let relativeTop = null, relativeLeft = null, relativeMinWidth = null, relativeWidth = null, relativeMinHeight = null, relativeHeight = null;
        if (position.indexOf('bottom') !== -1) {
            relativeTop = Math.max(0, box.height - panelHeight);
            if (position.indexOf('Right') !== -1) {
                relativeLeft = Math.max(0, box.width - panelWidth);
            } else if (position.indexOf('Left') !== -1) {
                relativeLeft = 0;
            } else {
                relativeLeft = Math.max(0, (box.width - panelWidth) / 2);
            }
        } else if (position.indexOf('top') !== -1) {
            relativeTop = 0;
            if (position.indexOf('Right') !== -1) {
                relativeLeft = Math.max(0, box.width - panelWidth);
            } else if (position.indexOf('Left') !== -1) {
                relativeLeft = 0;
            } else {
                relativeLeft = Math.max(0, (box.width - panelWidth) / 2);
            }
        }
        if (position === 'left') {
            relativeLeft = 0;
            relativeTop = Math.max(0, (box.height - panelHeight) / 2);
        } else if (position === 'right') {
            relativeLeft = Math.max(0, box.width - panelWidth);
            relativeTop = Math.max(0, (box.height - panelHeight) / 2);
        } else if (position === 'center') {
            relativeLeft = Math.max(0, (box.width - panelWidth) / 2);
            relativeTop = Math.max(0, (box.height - panelHeight) / 2);
        }
        if (isDefined(this.width)) {
            relativeMinWidth = '';
            relativeWidth = this.width;
        } else {
            relativeMinWidth = '';
            relativeWidth = '';
        }
        if (isDefined(this.height)) {
            relativeMinHeight = '';
            relativeHeight = this.height;
        } else {
            relativeMinHeight = '';
            relativeHeight = '';
        }
        return {
            relativeTop: relativeTop === null ? '' : relativeTop + 'px',
            relativeLeft: relativeLeft === null ? '' : relativeLeft + 'px',
            relativeMinWidth: relativeMinWidth,
            relativeWidth: relativeWidth,
            relativeMinHeight: relativeMinHeight,
            relativeHeight: relativeHeight,
        }
    }
    private _calcModalRelativePosition(position, connectElement: HTMLElement | MouseEvent, connectPosition) {
        const offset = 0;
        const box = this._getConnectBoundingBox(connectElement);
        const isWidthDefined = isDefined(this.width);
        const isHeightDefined = isDefined(this.height);
        const panelBox = this._getBBox();
        const panelWidth = isWidthDefined ? getPixel(this.width, box.width) : Math.min(panelBox.width, box.width);
        const panelHeight = isHeightDefined ? getPixel(this.height, box.height) : Math.min(panelBox.height, box.height);
        let relativeTop = null, relativeLeft = null, relativeMinWidth = null, relativeWidth = null, relativeMinHeight = null, relativeHeight = null;
        if (position.indexOf('bottom') !== -1) {
            relativeTop = Math.max(0, box.height - panelHeight);
            if (position.indexOf('Right') !== -1) {
                relativeLeft = Math.max(0, box.width - panelWidth);
            } else if (position.indexOf('Left') !== -1) {
                relativeLeft = 0;
            } else {
                relativeLeft = Math.max(0, (box.width - panelWidth) / 2);
            }
        } else if (position.indexOf('top') !== -1) {
            relativeTop = 0;
            if (position.indexOf('Right') !== -1) {
                relativeLeft = Math.max(0, box.width - panelWidth);
            } else if (position.indexOf('Left') !== -1) {
                relativeLeft = 0;
            } else {
                relativeLeft = Math.max(0, (box.width - panelWidth) / 2);
            }
        }
        if (position === 'left') {
            relativeLeft = 0;
            relativeTop = Math.max(0, (box.height - panelHeight) / 2);
        } else if (position === 'right') {
            relativeLeft = Math.max(0, box.width - panelWidth);
            relativeTop = Math.max(0, (box.height - panelHeight) / 2);
        } else if (position === 'center') {
            relativeLeft = Math.max(0, (box.width - panelWidth) / 2);
            relativeTop = Math.max(0, (box.height - panelHeight) / 2);
        }
        if (isDefined(this.width)) {
            relativeMinWidth = '';
            relativeWidth = this.width;
        } else {
            relativeMinWidth = '';
            relativeWidth = panelBox.width || '';
        }
        if (isDefined(this.height)) {
            relativeMinHeight = '';
            relativeHeight = this.height;
        } else {
            relativeMinHeight = '';
            relativeHeight = panelBox.height || '';
        }
        return {
            relativeTop: relativeTop === null ? '' : relativeTop + 'px',
            relativeLeft: relativeLeft === null ? '' : relativeLeft + 'px',
            relativeMinWidth: relativeMinWidth,
            relativeWidth: relativeWidth,
            relativeMinHeight: relativeMinHeight,
            relativeHeight: relativeHeight,
        }
    }
}

export class PopupPanelRef<T extends StateObject> implements IPopupPanelRef<T> {
    constructor(
        private _popupRef: IPopupRef<T>,
        private _container: HTMLElement,
        source: BindingSelector | BindingTemplate | HTMLElement | IUIStateStatic<T>,
        option?: IPopupOption<T>
    ) {
        this._placeholder = nativeApi.createComment();
        nativeApi.appendChild(this._container, this._placeholder);
        const state = (option || {}) as PopupPanelState<T>;
        state.source = source;
        this._oriState = {
            panelClass: state.panelClass,
            popupMode: state.popupMode,
            position: state.position,
            width: state.width,
            height: state.height,
        }
        this._ref = bindingFactory.create(PopupPanelState, state, {
            '[panelClass]': 'panelClass',
            '[autoClose]': 'autoClose',
            '[binding]': 'binding',
            '[state]': 'state',
            '[source]': 'source',
            '[popupMode]': 'popupMode',
            '[position]': 'position',
            '[width]': 'width',
            '[height]': 'height',
            '[connectElement]': 'connectElement',
            '[show]': 'show',
            '[shakeup]': 'shakeup',
            '(hidden)': 'onHidden()'
        }, [{
            token: TOKENS.POPUP_REF,
            use: this._popupRef
        }]);
    }
    private _ref: IBindingRef<PopupPanelState<T>>;
    private _placeholder;
    private _destroyed = false;
    private _oriState: IPopupPanelState = {};
    appear() {
        if (this._destroyed) return;
        this._ref.setState({
            show: true,
            onHidden: () => {
                this._ref.destroy();
            }
        })
        this._ref.attachTo(this._placeholder);
    }
    disappear() {
        if (this._destroyed) return;
        nativeApi.remove(this._placeholder);
        this._ref.setState({
            show: false
        })
        this._destroyed = true;
    }
    shakeup() {
        this._ref && this._ref.setState({ shakeup: true });
        setTimeout(() => {
            if (this._destroyed) return;
            this._ref && this._ref.setState({ shakeup: false });
        }, 60);
    }
    changeState(state: IPopupPanelState) {
        if (this._destroyed) return;
        const panelClass = this._oriState.panelClass;
        this._ref.setState({
            ...(this._oriState as any),
            ...(state || {}),
            panelClass: state.panelClass ? `${panelClass} ${state.panelClass}` : panelClass,
        });
        this.updatePosition();
    }
    updatePosition(connectElement?: HTMLElement | MouseEvent): void {
        if (this._destroyed) return;
        if (connectElement) {
            this._ref.setState({
                connectElement: connectElement,
            })
        }
        this._ref.resize();
    }
    detectChanges(): void {
        this._ref.detectChanges();
    }
}