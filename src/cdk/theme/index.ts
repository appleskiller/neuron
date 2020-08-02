import { IBindingRef } from '../../binding/common/interfaces';
import { composeGetter } from '../../binding/common/util';
import { parseContent } from '../../binding/compiler/parser/template';
import { parseStatement } from '../../binding/compiler/parser/statement';
import { createElement, removeMe } from 'neurons-dom';
import { globalLimitedDictionary } from 'neurons-utils';

type CompiledCSSBlock = string | (string | ((theme) => string))[];

const compiledCSSCache = globalLimitedDictionary<CompiledCSSBlock[]>('neurons.compiled_css_cache');

export class ThemeBindingRef {
    constructor(private container: HTMLElement, private compiledCSS: (string | ((theme) => string))[], private theme: any) {
        this.isPlain = !this.compiledCSS || !this.compiledCSS.length || this.compiledCSS.every(item => typeof item === 'string');
        this.styleDom = createElement('style') as HTMLStyleElement;
        this.styleDom.type = 'text/css';
        if (this.compiledCSS && this.compiledCSS.length) {
            const cssString = this.bind(theme);
            this.styleDom.innerHTML = cssString;
            this.container.appendChild(this.styleDom);
            this.previous = cssString;
        }
    }
    private isPlain;
    private styleDom: HTMLStyleElement;
    private previous: string;
    detectChanges() {
        if (this.isPlain) return;
        const cssString = this.bind(this.theme);
        if (this.previous !== cssString) {
            this.previous = cssString;
            this.styleDom.innerHTML = cssString;
        }
    }
    destroy() {
        removeMe(this.styleDom);
    }
    private bind(theme): string {
        theme = theme || {};
        let result = '';
        if (this.isPlain) {
            result = this.compiledCSS.join('');
        } else {
            result = this.compiledCSS.map(item => {
                if (typeof item === 'string') {
                    return item;
                } else {
                    return item(theme);
                }
            }).join('');
        }
        result = result.trim();
        result && (result = `\n${result}\n`)
        return result;
    }
}

function compileCSS(css: string): (string | ((theme) => string))[] {
    css = css || '';
    css = css.trim();
    if (!css) return [];
    const parsed = parseContent(css, '$');
    if (typeof parsed === 'string') {
        return [parsed];
    } else {
        return parsed.map(item => {
            if (typeof item === 'string') {
                return item;
            } else {
                const getter = composeGetter('ThemeBinding', item);
                return theme => {
                    let value;
                    try {
                        value = getter({context: theme})
                    } catch (error) {
                        value = '';
                    }
                    return value;
                }
            }
        }).reduce((ret, current) => {
            if (!ret.length) {
                ret.push(current);
            } else {
                if (typeof current === 'string' && typeof ret[ret.length - 1] === 'string') {
                    ret[ret.length - 1] = ret[ret.length - 1] + current;
                } else {
                    ret.push(current);
                }
            }
            return ret;
        }, []);
    }
}

const openRegExp = /[^{]\{[^{]/;
const closeRegExp = /[^}]\}[^}]/;

function firstChar(str: string): string {
    const openIndex = str.search(openRegExp);
    const closeIndex = str.search(closeRegExp);
    const index = str.indexOf(';');
    let min = openIndex;
    min = min === -1 ? closeIndex : (closeIndex == -1 ? min : Math.min(min, closeIndex));
    min = min === -1 ? index : (index == -1 ? min : Math.min(min, index));
    if (min === -1) return '';
    if (min === index) return ';';
    if (min === closeIndex) return '}';
    return '{';
}

function pickCSSBody(css: string, selector: string = '') {
    css = css || '';
    if (!css) return {rest: '', blocks: []};
    let rest = css, blocks = [], body;
    let closeIndex = rest.search(closeRegExp);
    while(closeIndex >= 0) {
        let openIndex = rest.search(openRegExp);
        if (openIndex === -1 || openIndex > closeIndex) {
            // 直接结束
            body = rest.substr(0, closeIndex);
            body && blocks.push(`${selector} {${body}\n}\n`);
            rest = rest.substr(closeIndex + 2);
            return {rest: rest, blocks: blocks};
        } else {
            let index = (rest.substr(0, openIndex)).lastIndexOf(';');
            if (index !== -1) {
                body = rest.substr(0, index + 1);
                body && blocks.push(`${selector} {${body}\n}\n`);
                rest = rest.substr(index + 1);
            }
            // 子节点
            const ret = pickCSSBlocks(rest, selector);
            // const ret = pickCSSBlocks(`${selector} { ${rest}`);
            rest = ret.rest;
            blocks = blocks.concat(ret.blocks);
            // 继续查找
            closeIndex = rest.search(closeRegExp);
        }
    }
    rest = rest.trim();
    if (rest) {
        blocks.push(`${selector} {${rest}\n}\n`);
    }
    return {rest: rest, blocks: blocks};
}

function pickCSSBlocks(css: string, prefix: string = '') {
    css = css || '';
    if (!css) return {rest: '', blocks: []};
    let rest = css, blocks = [], openIndex, closeIndex, index;
    while (rest) {
        openIndex = rest.search(openRegExp);
        if (openIndex >= 0) {
            let selector = rest.substring(0, openIndex + 1).trim();
            if (selector) {
                // &作为连接符
                if (selector.charAt(0) === '&') {
                    selector = prefix + selector.substr(1);
                } else {
                    selector = prefix ? prefix + ' ' + selector : selector;
                }
                const ret = pickCSSBody(rest.substr(openIndex + 2), selector);
                rest = ret.rest;
                blocks = blocks.concat(ret.blocks);
                // 检查平级节点
                const char = firstChar(rest);
                if (char === ';' || char === '}') {
                    return {rest: rest, blocks: blocks};
                }
            } else {
                rest = '';
            }
        } else {
            rest = '';
        }
    }
    return {rest: rest, blocks: blocks};
}

export interface IThemeBinding {
    setState(state: any): void;
    detectChanges(): void;
    destroy(): void;
}

export function bindTheme(css: string, theme: any, prefix: string = ''): IThemeBinding {
    let compiledCSS = compiledCSSCache.get(css);
    if (!compiledCSS) {
        const ret = pickCSSBlocks(css);
        const blocks = ret.blocks;
        compiledCSS = blocks.reduce((ret, current) => {
            const compiled = compileCSS(current);
            if (compiled.length) {
                const isPlain = compiled.every(item => typeof item === 'string');
                if (!ret.length) {
                    isPlain ? ret.push(compiled.join('')) : ret.push(compiled);
                } else {
                    if (isPlain && typeof ret[ret.length - 1] === 'string') {
                        ret[ret.length - 1] = ret[ret.length - 1] + '\n' + compiled.join('');
                    } else {
                        ret.push(compiled);
                    }
                }
            }
            return ret;
        }, []);
        compiledCSSCache.set(css, compiledCSS);
    }
    let internalTheme = {...(theme || {})};
    const refs = compiledCSS.map(compiled => {
        if (typeof compiled === 'string') {
            return new ThemeBindingRef(document.head, [compiled], internalTheme);
        } else {
            return new ThemeBindingRef(document.head, compiled, internalTheme);
        }
    });
    let _destroyed = false;
    const binding = {
        setState: (state) => {
            if (_destroyed || !state) return;
            Object.assign(internalTheme, state);
            refs.forEach(ref => ref.detectChanges());
        },
        detectChanges: () => {
            if (_destroyed) return;
            refs.forEach(ref => ref.detectChanges());
        },
        destroy: () => {
            refs.forEach(ref => ref.destroy());
            _destroyed = true;
        }
    };
    return binding;
}
