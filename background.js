if (typeof browser === "undefined") {
    browser = chrome;
}

const hubBaseUrl = new URL('https://hub.libstc.cc')

function getDownloadUrl(doi) {
    return new URL(`${doi}.pdf`, hubBaseUrl);
}


async function handleDoi(doi) {
    const url = getDownloadUrl(doi);
    console.log(`Attempting to download pdf from ${url}`)

    const downloadId = await browser.downloads.download({
        url: url.href,
        filename: `${doi}.pdf`
    });

    if (!downloadId) {
        console.log(`Download for ${url} failed to start`)
        return
    }

    downloadDois.set(downloadId, doi);
    console.log(`Started download with id ${downloadId} from ${url}`);

    // if the PDF is not found it will typically instantly 404
    // if PDF exists, it may take some time for iroh to locate
    const timeout = 60 * 1000;
    await new Promise(r => setTimeout(r, timeout));

    if (downloadId) {
        const downloads = await browser.downloads.search({id: downloadId});
        const download = downloads[0];
        if (!download) {
            return;
        }
        const bytesReceived = download.bytesReceived;
        console.log(`Received ${bytesReceived} after ${timeout} ms`);
        const downloadStarted = bytesReceived !== 0;

        if (!downloadStarted) {
            // clean up if download failed to start
            await handleDownloadFailed(downloadId)
        }
    }
}

const downloadDois = new Map();


function handleDownloadComplete(id) {
    console.log(`Download ${id} succeeded for doi ${downloadDois.get(id)}`)
    downloadDois.delete(id)
}

async function handleDownloadFailed(id) {
    const doi = downloadDois.get(id)
    downloadDois.delete(id)
    console.log(`Download ${id} failed for doi ${doi}`)

    await browser.downloads.erase({id: id})
}

async function onDownloadChanged(delta) {
    if (!downloadDois.has(delta.id)) return

    console.log(`download delta: ${JSON.stringify(delta)}`)
    if (delta.state) {
        if (delta.state.current === "complete") {
            handleDownloadComplete(delta.id)
        } else if (delta.state.current === "interrupted") {
            await handleDownloadFailed(delta.id)
        }
    }
}

async function onMessage(request, sender, sendResponse) {
    console.log(request);
    if (request.download) {
        const doi = await navigator.clipboard.readText();
        await handleDoi(doi);
    } else if (request.fetchDoi) {
        const doi = await navigator.clipboard.readText();
        const [tab] = await browser.tabs.query({active: true, lastFocusedWindow: true});
        await browser.tabs.sendMessage(tab.id, {upload: true, doi: doi});
    }
}

browser.runtime.onMessage.addListener(onMessage);

browser.downloads.onChanged.addListener(onDownloadChanged);
