#!/usr/bin/env node
const readline = require('readline');
const path = require('path');
const http = require('http');
const fs = require('fs');

const [,, ...args] = process.argv;

const jsonFromStream = (stream, cb) => {
    let raw = '';
    stream.on('data', (chunk) => raw += chunk);
    stream.on('error', (err) => {
        return cb(err, {});
    });
    stream.on('end', () => {
        const json = JSON.parse(raw);
        return cb(false, json);
    });
}
class Cache {
    constructor(cacheFile) {
        this.cacheFile = cacheFile;
        this.cache = {};
    }

    readFile(cb) {
        const cacheStream = fs.createReadStream(this.cacheFile);
        jsonFromStream(cacheStream, (err, data) => {
            if (err) process.stderr.write('could not read cache file\n');
            this.cache = data;
            cb();
        });
    }

    writeToFile(file = this.cacheFile) {
        fs.writeFile(file, JSON.stringify(this.cache), (err) => {
            if (err) process.stderr.write('could not create cache file\n');
        });
    }

    startCountdown(t = 2000) {
        this.timer = setTimeout(() => this.writeToFile(), t);
    }

    extendCountdown() {
        clearTimeout(this.timer);
        this.startCountdown();
    }
}

const cache = new Cache(path.join(__dirname, 'cache.json'));

const writeOut = (message, line, col) => {
    process.stdout.write(`E:123:${line}:${col}:${message}\n`);
};
const request = (dep, cb) => {
    cache.extendCountdown();
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
            return cb(true, {});
        }
        jsonFromStream(res, cb);
    });
};
const checkVersion = (dep, version) => {
    const versionCompare = (current, latest) => {
        const cur = /([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(current);
        const lat = /([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(latest);
        return (lat[1] > cur[1] || lat[2] > cur[2] || lat[3] > cur[3]);
    };
    const cachedDep = cache.cache[dep];
    const aDayAgo = Date.now() - (1000 * 60 * 60 * 24);
    return new Promise(resolve => {
        if (cachedDep && cachedDep.timestamp > aDayAgo) {
            versionCompare(version, cachedDep.version) &&
            resolve(`${dep} latest version: ${cachedDep.version}`);
        } else {
            request(dep, (err, json) => {
                if (err) {
                    resolve(`failed to fetch latest version of ${dep}`);
                } else {
                    const { latest } = json['dist-tags'];
                    cache.cache[dep] = { version: latest, timestamp: Date.now() };
                    versionCompare(version, latest) &&
                    resolve(`${dep} latest version: ${latest}`);
                }
            });
        }
    });
};
const handleLineGen = () => {
    const modulesStart = /"dependencies"|"devDependencies"/;
    const extractDep = /"([^"]+)": ".?([0-9]+\.[0-9]+\.[0-9]+)"/;

    let inModule = false;
    const handleLine = async (line, i) => {
        if (inModule) {
            const depExtract = extractDep.exec(line); // do more destructuring
            if (depExtract) {
                const col = depExtract.index + 1;
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
    return handleLine;
}
const getLines = () => {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
    const handleLine = handleLineGen();

	const mainloop = async () => {
        let i = 0;
		for await (const line of rl) {
			i++;
            handleLine(line, i);
		}
	}
	mainloop();
};

cache.readFile(() => {
    cache.startCountdown();
    if (path.basename(args[0]) === 'package.json') {
        getLines();
    }
});
