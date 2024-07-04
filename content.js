if (typeof browser === "undefined") {
    browser = chrome;
}

/**
 * @param node {Node}
 * @return {Node[]}
 */
function getDoiNodes(node) {
    if (node.childNodes.length === 0 && node.textContent === 'DOI') return [node];

    const nodes = [];
    node.childNodes.forEach(child => {
        nodes.push(...getDoiNodes(child));
    });
    return nodes;
}

/**
 * @param doiNode {HTMLElement}
 */
async function onDownloadPdfClick(doiNode) {
    doiNode.click();
    await browser.runtime.sendMessage({download: true});
}

const obs = new MutationObserver(function (mutations, observer) {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const doiNodes = getDoiNodes(node);
                if (doiNodes.length === 0) return;
                doiNodes.forEach(doiNode => {
                    const doiSpan = doiNode.parentElement;
                    const doiSpanHolder = doiSpan.parentElement;

                    const parentSpan = document.createElement("span");
                    parentSpan.className = doiSpanHolder.className;
                    parentSpan.addEventListener("click",
                        async (event) => {
                            event.stopPropagation();
                            return onDownloadPdfClick(doiSpanHolder);
                        });

                    const span = document.createElement("span");
                    span.className = doiSpan.className;
                    span.textContent = "Download PDF";
                    parentSpan.appendChild(span);

                    doiSpanHolder.parentNode.appendChild(parentSpan);
                });
            }
        })
    })
});

obs.observe(document, {childList: true, subtree: true, attributes: false, characterData: false});
