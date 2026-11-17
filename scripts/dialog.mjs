// DialogV2 serializes HTMLElement content, rejecting attributes and discarding
// attached listeners. Mount the live form after the native dialog renders.
export function waitDialog({content,render,...options}) {
  if (!(content instanceof HTMLElement)) throw Error('Содержимое окна должно быть HTML-элементом.');
  return foundry.applications.api.DialogV2.wait({
    ...options,
    classes:['dialog','margora-dialog',...(options.classes??[])],
    content:'<div></div>',
    render(event,dialog) {
      const target=dialog.element.querySelector('.dialog-content');
      if (!target) throw Error('Не удалось создать содержимое окна.');
      content.classList.add('mp-dialog-body');target.replaceChildren(content);
      render?.(event,dialog);dialog.setPosition?.({height:'auto'});const observer=new ResizeObserver(()=>dialog.setPosition?.({height:'auto'}));observer.observe(target);dialog.addEventListener?.('close',()=>observer.disconnect(),{once:true});
    }
  });
}
