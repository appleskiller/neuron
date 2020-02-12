import { IEmitter } from 'neurons-emitter';
import { BindingSelector, BindingTemplate, IUIStateStatic, IBindingDefinition, StateObject } from '../../binding/common/interfaces';

export const TOKENS = {
    POPUP_REF: 'POPUP_REF'
}

export enum PopupPosition {
    center = 'center',
    top = 'top',
    left = 'left',
    bottom = 'bottom',
    right = 'right',
    topLeft = 'topLeft',
    topRight = 'topRight',
    bottomLeft = 'bottomLeft',
    bottomRight = 'bottomRight',
}

export enum PopupAnimation {
    'scaleUp' = 'scale-up',
    'scaleDown' = 'scale-down',
    'slideUp' = 'slide-up',
    'slideDown' = 'slide-down',
    'slideLeft' = 'slide-left',
    'slideRight' = 'slide-right',
    'slideCenter' = 'slide-center',
    'spreadUp' = 'spread-up',
    'spreadDown' = 'spread-down',
    'spreadLeft' = 'spread-left',
    'spreadRight' = 'spread-right',
    'spreadMiddle' = 'spread-middle',
}

export enum PopupMode {
    'modal' = 'modal',
    'dropdown' = 'dropdown',
    'tooltip' = 'tooltip',
    'sidepanel' = 'sidepanel',
}

export interface IPopupManagerConfig {
    container?: HTMLElement;
}

export interface IPopupOptionBase {
    panelClass?: string;
    position?: 'center' | 'top' | 'left' | 'bottom' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | string;
    width?: number | string;
    height?: number | string;
    connectElement?: HTMLElement | MouseEvent;
    binding?: IBindingDefinition;
    state?: StateObject;
}

export interface IPopupOption<T extends StateObject> extends IPopupOptionBase {
    hasOverlay?: boolean;
    overlayClass?: string;
    overlayBackgroundColor?: string;
    autoClose?: boolean;
    disableClose?: boolean;
    popupMode?: 'modal' | 'dropdown' | 'tooltip' | string;
}

export interface IPopupPanelState {
    panelClass?: string;
    popupMode?: 'modal' | 'dropdown' | 'tooltip' | string;
    position?: 'center' | 'top' | 'left' | 'bottom' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | string;
    width?: number | string;
    height?: number | string;
    binding?: IBindingDefinition;
    state?: StateObject;
}

export interface IToolTipOption extends IPopupOptionBase {
    position?: 'mouse' | 'top' | 'left' | 'bottom' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | string;
    delayTime?: number;
}

export interface IPopupOverlayRef<T extends StateObject> {
    onClick: IEmitter<MouseEvent>;
    onDispeared: IEmitter<void>;
    onDispear: IEmitter<void>;
    onAppeared: IEmitter<void>;
    appear();
    disappear();
    detectChanges(): void;
}

export interface IPopupPanelRef<T extends StateObject> {
    shakeup();
    appear();
    disappear();
    changeState(state: IPopupPanelState): void;
    updatePosition(connectElement?: HTMLElement | MouseEvent): void;
    detectChanges(): void;
}

export interface IPopupManager {
    config(option: IPopupManagerConfig): void;
    open<T extends StateObject>(component: BindingSelector | BindingTemplate | HTMLElement | IUIStateStatic<T>, option?: IPopupOption<T>): IPopupRef<T>;
    close(): void;
    updatePosition(): void;
}

export interface IPopupRef<T extends StateObject> {
    option: IPopupOption<T>;
    overlay: IPopupOverlayRef<T>;
    panel: IPopupPanelRef<T>;
    updatePosition(connectElement?: HTMLElement | MouseEvent): void;
    open(source: BindingSelector | BindingTemplate | HTMLElement | IUIStateStatic<T>, option?: IPopupOption<T>): void;
    close(): void;
    onClose: IEmitter<IPopupRef<T>>;
    onClosed: IEmitter<IPopupRef<T>>;
    onOpened: IEmitter<IPopupRef<T>>;
}

export interface IToolTipRef {
    open(connectElement?: HTMLElement | MouseEvent): void;
    updatePosition(connectElement?: HTMLElement | MouseEvent): void;
    updateOption(option?: IToolTipOption): void;
    close(): void;
}

export function noop() {};