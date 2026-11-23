function readState() {
    const [path, query] = location.hash.slice(2).split("?");
    return {
        path: path.split("/").filter(Boolean).map(decodeURIComponent).join("/"),
        q: new URLSearchParams(query).get("q") || ""
    };
}

function linkTo(path, q) {
    const encoded = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    return "#/" + encoded + (q ? "?q=" + encodeURIComponent(q) : "");
}

function formatSize(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }
    return (i === 0 ? bytes : bytes.toFixed(1)) + " " + units[i];
}

function el(tag, text, parent) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
}

function renderBreadcrumbs(path) {
    const box = document.getElementById("breadcrumbs");
    box.replaceChildren();
    el("a", "Home", box).href = linkTo("");

    let current = "";
    for (const part of path.split("/").filter(Boolean)) {
        current += (current ? "/" : "") + part;
        el("span", " / ", box);
        el("a", part, box).href = linkTo(current);
    }
}

function renderRows(entries) {
    const rows = document.getElementById("rows");
    rows.replaceChildren();

    for (const entry of entries) {
        const tr = el("tr", undefined, rows);
        const name = el("td", undefined, tr);

        if (entry.isFolder) {
            el("a", "[+] " + entry.name, name).href = linkTo(entry.path);
        } else {
            el("a", entry.name, name).href = "/api/files/download?path=" + encodeURIComponent(entry.path);
        }

        el("td", entry.isFolder ? "" : formatSize(entry.size), tr);
        el("td", new Date(entry.modified).toLocaleString(), tr);
    }
}

async function load() {
    const state = readState();
    document.getElementById("q").value = state.q;
    document.getElementById("error").textContent = "";
    renderBreadcrumbs(state.path);

    const params = new URLSearchParams({ path: state.path, q: state.q });
    const response = await fetch("/api/files?" + params);
    if (!response.ok) {
        document.getElementById("error").textContent = "Folder not found";
        renderRows([]);
        return;
    }

    const data = await response.json();
    renderRows(data.entries);
    document.getElementById("summary").textContent =
        data.folderCount + " folders, " + data.fileCount + " files, " + formatSize(data.totalSize);
}

document.getElementById("search").addEventListener("submit", e => {
    e.preventDefault();
    location.hash = linkTo(readState().path, document.getElementById("q").value.trim());
});

document.getElementById("upload").addEventListener("submit", async e => {
    e.preventDefault();
    const files = document.getElementById("files").files;
    if (!files.length) return;

    const form = new FormData();
    for (const file of files) form.append("files", file);

    const params = new URLSearchParams({ path: readState().path });
    const response = await fetch("/api/files/upload?" + params, { method: "POST", body: form });
    if (!response.ok) document.getElementById("error").textContent = "Upload failed";

    document.getElementById("files").value = "";
    load();
});

document.getElementById("newFolder").addEventListener("submit", async e => {
    e.preventDefault();
    const name = document.getElementById("folderName").value.trim();
    if (!name) return;

    const params = new URLSearchParams({ path: readState().path, name });
    const response = await fetch("/api/files/folder?" + params, { method: "POST" });
    if (!response.ok) document.getElementById("error").textContent = "Could not create folder";

    document.getElementById("folderName").value = "";
    load();
});

window.addEventListener("hashchange", load);
load();
