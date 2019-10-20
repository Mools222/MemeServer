const http = require("http");
const fs = require("fs");
const {parse} = require("url");
const {resolve, sep} = require("path");
const baseDirectory = process.cwd() + "\\meme";
const mime = require("mime");

exports.runMemeServer = function (port) {
    http.createServer((request, response) => {
        get(request)
            .catch(error => {
                if (error.status != null)
                    return error;

                return {body: String(error), status: 500};
            })
            .then(({body, status = 200, type = "text/plain"}) => {
                response.writeHead(status, {"Content-Type": type});

                if (body && body.pipe) // If body is not null (which resolves to false) and if body has a pipe method (meaning it's a ReadStream)
                    body.pipe(response);
                else
                    response.end(body);
            });
    }).listen(port);
};

async function get(request) {
    let path = urlPath(request.url);

    let stats;

    try {
        stats = fs.statSync(path);
    } catch (error) {
        if (error.code !== "ENOENT")
            throw error;
        else
            return {status: 404, body: "File not found"};
    }

    if (stats.isDirectory()) {
        let files = fs.readdirSync(path);

        let cssString = request.url === "/meme/" ? "MemeServer.css" : "meme/MemeServer.css";

        let htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>MemeServer</title>
    <link rel="stylesheet" href="${cssString}">
    <link rel="icon" href="/meme/favicon.ico">
</head>
<body>
<table>
<tr>
    <th>File</th>
    <th>Size</th>
    <th>Accessed</th>
    <th>Modified</th>
    <th>File status changed</th>
    <th>Creation</th>
</tr>`;

        for (let fileName of files) {
            let fileStats = fs.statSync(path + sep + fileName);
            let aTag = `<a href="` + (request.url === "/meme/" ? `${fileName}` : `meme\\${fileName}`) + `">${fileName}</a><br>`;

            if (fileName !== "MemeServer.css")
                htmlString += `<tr>
    <td>${aTag}</td>
    <td>${fileStats.size}</td>
    <td>${fileStats.atime.toUTCString()}</td>
    <td>${fileStats.mtime.toUTCString()}</td>
    <td>${fileStats.ctime.toUTCString()}</td>
    <td>${fileStats.birthtime.toUTCString()}</td>
  </tr>`
        }

        htmlString += `</table>
</body>
</html>`;

        return {body: htmlString, status: 200, type: "text/html"};
    } else {
        return {body: fs.createReadStream(path), type: mime.getType(path)};
    }
}

function urlPath(url) {
    let {pathname} = parse(url); // The parse method returns a UrlWithStringQuery object, which contains a binding named "pathname". Destructuring is used to access it directly

    let path = resolve(decodeURIComponent(pathname).slice(1));
    if (path === process.cwd()) // This allows "http://localhost:8000/" to access "http://localhost:8000/meme"
        path = baseDirectory;

    if (path !== baseDirectory && !path.startsWith(baseDirectory + sep)) {
        let fileFound = checkMemeFolder(pathname);

        if (fileFound) // If fileFound is not undefined (which evaluates to false)
            path = baseDirectory + sep + fileFound;
        else
            throw {status: 403, body: "Forbidden"};
    }

    return path;
}

function checkMemeFolder(fileName) {
    if (fileName.length === 1)
        return;

    let files = fs.readdirSync("./meme");
    let fileFound;
    let regExp = new RegExp("^" + fileName.slice(1) + ".[^.]+");

    for (let fileName of files)
        if (regExp.test(fileName))
            fileFound = fileName;

    return fileFound;
}