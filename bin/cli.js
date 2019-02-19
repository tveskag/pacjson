#!/usr/bin/env node
const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

const [,, ...args] = process.argv;

const writeOut = (dependency, version, line) => {
	process.stdout.write(`E:123:${line}:${dependency.index}:${dependency[1]} latest version: ${version}\n`);
};
const getLines = (list) => {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	let inModule = false;
	const modulesStart = /"dependencies"|"devDependencies"/;
	const extractDep = /"([^"]+)"/;

	const checkVersion = (dep) => {
		const reg = new RegExp(`${dep}\\s*([0-9]+\\.[0-9]+\\.[0-9]+)\\s*([0-9]+\\.[0-9]+\\.[0-9]+)\\s*([0-9]+\\.[0-9]+\\.[0-9]+)`, 'g');
		return reg.exec(list);
	};
	let i = 0;
	const mainloop = async () => {
		for await (const line of rl) {
			i++;
			if (inModule) {
				const dependency = extractDep.exec(line);
				if (dependency) {
					const versions = checkVersion(dependency[1]);
					if (versions) {
						writeOut(dependency, versions[3], i);
					}
				} else {
					inModule = false;
				}
			} else {
				inModule = modulesStart.test(line);
			}
		}
	}
	mainloop();
};

const spawnChild = () => {
	const npm = spawn('npm', ['outdated']);
	let outdated = "";

	npm.stdout.on('data', (data) => {
		outdated += data;
	});
	npm.on('close', (signal) => {
		// if (signal == bad) terminate;
		getLines(outdated);
	});
};
if (path.basename(args[0]) === 'package.json') {
	spawnChild();
}
