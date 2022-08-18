const fetch = require("node-fetch");

const PROJECT_MAPPING_SOURCE_URL = 'https://advisories.aws.barahmand.com/projects/config.json';
const PROJECT_ADVISORIES_URL = 'https://advisories.aws.barahmand.com/vulnerabilities/{NAME}/{TAG}';
const GENERIC_ADVISORIES_URL = 'https://advisories.aws.barahmand.com';

// Intervals in ms
const REFRESH_INTERVAL = 3600 * 12 * 1000;
const RETRY_INTERVAL = 60 * 1000;

const cachedMapping = new Map();
const getMapping = async () => {
    try {
        const result = await fetch(PROJECT_MAPPING_SOURCE_URL);
        const projects = await result.json();
        if (!Array.isArray(projects) || projects.length === 0) {
            console.log(projects);
            throw 'Received no project mapping';
        }

        cachedMapping.clear();
        for (const { name, repo } of projects) {
            cachedMapping.set(repo, name);
        }

        setTimeout(getMapping, REFRESH_INTERVAL);
    } catch (ex) {
        console.error(ex);
        setTimeout(getMapping, RETRY_INTERVAL);
    }
};

// Start the cycle
// await getMapping();

getMapping();

module.exports = {
    getURLForRepository: (repo, tag = '') => {
        return cachedMapping.has(repo)
            ? PROJECT_ADVISORIES_URL
                .replace(/\{NAME}/g, cachedMapping.get(repo))
                .replace(/\{TAG}/g, tag)
                .replace(/\/{2,}/g, '\/')
                .replace(/\/$/, '')
            : GENERIC_ADVISORIES_URL
    }
}