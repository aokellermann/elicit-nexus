if (typeof browser === "undefined") {
    browser = chrome;
}

browser.runtime.onMessage.addListener(onMessage);

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

/**
 * @param doiNode {HTMLElement}
 */
async function onUploadPdfClick(doiNode) {
    doiNode.click();
    await browser.runtime.sendMessage({fetchDoi: true});
}

const hubBaseUrl = new URL('https://hub.libstc.cc')

function getDownloadUrl(doi) {
    return new URL(`${doi}.pdf`, hubBaseUrl);
}

async function onMessage(request, sender, sendResponse) {
    console.log(request);
    if (request.upload) {
        const pdf = await fetch(getDownloadUrl(request.doi));
        if (pdf.status >= 400) {
            console.log('pdf failed');
            return;
        }

        const kitchenRes = await fetch("https://elicit.com/api/kitchen/upload-pdf", {method: 'POST'});
        if (kitchenRes.status >= 400) {
            console.log('kitchen failed')
            return;
        }

        const kitchenResObj = await kitchenRes.json();
        const uploadRes = await fetch(kitchenResObj.uploadUrl, {
            method: 'PUT',
            body: await pdf.blob(),
            headers: {'content-type': 'application/pdf'}
        })
        if (uploadRes.status >= 400) {
            console.log('upload failed')
            return;
        }

        const saveWorkRes = await fetch("https://elicit.com/api/kitchen/save-work", {
            method: 'POST',
            body: JSON.stringify({
                "bucket": kitchenResObj.bucket,
                "key": kitchenResObj.key,
                "filename": `${request.doi}.pdf`,
                "tagIds": []
            }),
            headers: {'content-type': 'application/json'}
        })
        if (saveWorkRes >= 400) {
            console.log('save work failed')
        }
    }
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
                            return onUploadPdfClick(doiSpanHolder);
                            // return onDownloadPdfClick(doiSpanHolder);
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
