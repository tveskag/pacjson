#!/usr/bin/env node
const readline = require('readline');
const path = require('path');
// const fs = require('fs');
const http = require('http');

const [,, ...args] = process.argv;

const writeOut = (message, line, col) => {
    process.stdout.write(`
        E:${line}:${col}:${message}\n
    `);
};
const request = (dep, cb) => {
    const opt = {
        host: "registry.npmjs.org",
        path: `/${dep}`,
        method: "GET",
        headers: {
            "Accept": "application/vnd.npm.install-v1+json"
        }
    };
    http.get(opt, (res) => {
        const { statusCode } = res;
        if (statusCode !== 200) {
            res.destroy();
            return cb(true, null);
        }
        let raw = '';
        res.on('data', (chunk) => raw += chunk);
        return res.on('end', () => {
            return cb(false, raw);
        });
    });

}
const checkVersion = (dep, version) => {
    const versionCompare = (current, latest) => {
        const cur = /([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(current);
        const lat = /([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(latest);
        return lat[1] > cur[1] || lat[2] > cur[2] || lat[3] > cur[3];
    }
    return new Promise(resolve => {
        request(dep, (err, raw) => {
            if (err) {
                return resolve(`failed to fetch latest version of ${dep}`);
            }
            const {latest} = JSON.parse(raw)['dist-tags'];
            let out = null;
            if (versionCompare(version, latest)) {
                out = `${dep} latest version: ${latest}`;
            }
            resolve(out);
        });
    });
};
const getLines = () => {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	const modulesStart = /"dependencies"|"devDependencies"/;
	const extractDep = /"([^"]+)": ".?([0-9]+\.[0-9]+\.[0-9]+)"/;

	let inModule = false;
    const handleLine = async (line, i) => {
        if (inModule) {
            const depExtract = extractDep.exec(line); // do more destructuring
            if (depExtract) {
                const col = depExtract.index;
                const [, dependency, version] = depExtract;
                const message = await checkVersion(dependency, version);
                if (message) {
                    writeOut(message, i, col);
                }
            } else {
                inModule = false;
            }
        } else {
            inModule = modulesStart.test(line);
        }
    };
	const mainloop = async () => {
        let i = 0;
		for await (const line of rl) {
			i++;
            handleLine(line, i);
		}
	}
	mainloop();
};

if (path.basename(args[0]) === 'package.json') {
	getLines();
}
