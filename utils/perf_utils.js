const fs = require('fs');
const fetch = require('node-fetch');
const utility = require('./utils.js');

const NUM_OF_PERFS = 20;

async function perf_fetch(res){
    // init
    let folder_name = 'perf_jsons';

    // fetch perf numbers from Jenkins API
    let perf_url = 'https://build.ci.opensearch.org/job/perf-test/';
    let jobs = await fetch(perf_url + '/api/json');
    let jobs_json = await jobs.json();

    let perf_nums = []; 
    let ejs_pass = []; // data passed to EJS
    const perf_num_set = {}; // set of perf nums kept track of for deletion

    // loop through past X performance tests, add their number to an object
    for(let i = 0; i < NUM_OF_PERFS; i++){
        perf_nums.push({number: jobs_json.builds[i].number});
        perf_num_set[jobs_json.builds[i].number.toString()] = null; // for deleting old perf_jsons folders
    }
   
    // for each performance test number
    for(const perf_num of perf_nums){

        // if performance number folder doesn't exist
        if(!fs.existsSync('perf_jsons/' + perf_num.number.toString())){

            // make more specific jenkins API call
            let new_url = perf_url + '/' + perf_num.number.toString() + '/api/json';
            let specific_perf = await fetch(new_url);
            let perf_json = await specific_perf.json();

            // regex for getting version, build number, and architecture from JSON property: description.
            const version_re = /[0-9].[0-9].[0-9]/;
            const build_no_re = /Running performance test for build number: ([0-9]*) /;
            const architecture_re = /https:\/\/ci.opensearch.org\/ci\/dbc\/distribution-build-opensearch\/[0-9].[0-9].[0-9]\/[a-zA-Z0-9]+\/linux\/([a-zA-Z0-9]+)\/tar\/[a-zA-Z0-9]+\/opensearch\/manifest.yml/;
            
            // add properties for later display
            perf_num.version = perf_json.description?.match(version_re)[0];
            perf_num.buildNumber = perf_json.description?.match(build_no_re)[1];
            perf_num.architecture = perf_json.description?.match(architecture_re)[1];
            
            perf_num.result = perf_json.result;
            perf_num.running = perf_json.building ? "Running" : "Done";
            
            // if performance test is not still running
            if(!perf_json.building){
                if(perf_num.result === 'FAILURE'){
                    fs.mkdirSync(`${folder_name}/${perf_num.number}/FAILURE`, {recursive: true});
                }
                if(perf_num.result === 'ABORTED'){
                    fs.mkdirSync(`${folder_name}/${perf_num.number}/ABORTED`, {recursive: true});
                }

                // create URL and download JSON into perf number folder
                let url_with = `https://ci.opensearch.org/ci/dbc/perf-test/${perf_num.version}/${perf_num.buildNumber}/linux/${perf_num.architecture}/tar/test-results/${perf_num.number}/perf-test/with-security/perf-test.json`;
                let url_without = `https://ci.opensearch.org/ci/dbc/perf-test/${perf_num.version}/${perf_num.buildNumber}/linux/${perf_num.architecture}/tar/test-results/${perf_num.number}/perf-test/without-security/perf-test.json`;
                
                await perf_dl(url_with, folder_name, perf_num, 'with_security', ejs_pass);
                await perf_dl(url_without, folder_name, perf_num, 'without_security', ejs_pass);
                
            }
        }
        
        // create and push objects into the list that will be given to EJS
        ejs_pass.push(create_perf_obj(perf_num, 'with_security'));
        ejs_pass.push(create_perf_obj(perf_num, 'without_security'));
        
    }

    // handle deletion
    utility.check_delete(folder_name, perf_num_set); 

    res.render('perf', {perf_nums: ejs_pass});
}

exports.perf_fetch = perf_fetch;

// Creates an object and fills it with data that will eventually be rendered (as one row)
function create_perf_obj(perf_num, security){

    let obj = {number: perf_num.number};
    obj.running = 'Done'; // Assume done, if it's still running it will be set later

    // check for folder markers
    if(fs.existsSync(`perf_jsons/${perf_num.number}/ABORTED`)){
        obj.result = 'ABORTED';
    }
    else if(fs.existsSync(`perf_jsons/${perf_num.number}/FAILURE`)){
        obj.result = 'FAILURE';
    }
    else if(fs.existsSync(`perf_jsons/${perf_num.number}/${security}/JSON_403`)){
        obj.result = 'Cannot fetch JSON';
    } 
    else if(fs.existsSync(`perf_jsons/${perf_num.number}/${security}/perf.json`)){ // if JSON successfully downloaded
        try { // try reading from the file

            const metrics_json = JSON.parse(fs.readFileSync(`perf_jsons/${perf_num.number}/${security}/perf.json`));

            obj.buildNumber = metrics_json.buildNumber;
            obj.result = metrics_json.result;
            obj.version = metrics_json.version;
            obj.architecture = metrics_json.architecture;
            obj.security_enabled = security;
            obj.startTime = utility.start_date_convert(metrics_json.testResults.testStartTime);
            obj.duration = utility.convert_build_duration(metrics_json.testResults.testDuration);

            obj.instanceType = metrics_json.systemUnderTest.dataNodeInstanceType;
            obj.workloadDetails = `${metrics_json.workloadConfig.dataset} / ${metrics_json.workloadConfig.warmupIterations} warmupIterations / ${metrics_json.workloadConfig.testIterations} testIterations`;
            obj.indexLatency50 = metrics_json.testResults.operationsSummary.index.latencyMillis.p50;
            obj.indexLatency90 = metrics_json.testResults.operationsSummary.index.latencyMillis.p90;
            obj.indexLatency99 = metrics_json.testResults.operationsSummary.index.latencyMillis.p99;
            obj.indexLatency100 = metrics_json.testResults.operationsSummary.index.latencyMillis.p100;
            obj.indexThroughput0 = metrics_json.testResults.operationsSummary.index.requestsPerSecond.p0;
            obj.indexThroughput50 = metrics_json.testResults.operationsSummary.index.requestsPerSecond.p50;
            obj.indexThroughput100 = metrics_json.testResults.operationsSummary.index.requestsPerSecond.p100;
            obj.indexOperationOpCount = metrics_json.testResults.operationsSummary.index.opCount;
            obj.indexOperationErrCount = metrics_json.testResults.operationsSummary.index.opErrorCount;
            obj.indexOperationErrRate = metrics_json.testResults.operationsSummary.index.opErrorRate;
            obj.queryLatency50 = metrics_json.testResults.operationsSummary.query.latencyMillis.p50;
            obj.queryLatency90 = metrics_json.testResults.operationsSummary.query.latencyMillis.p90;
            obj.queryLatency99 = metrics_json.testResults.operationsSummary.query.latencyMillis.p99;
            obj.queryLatency100 = metrics_json.testResults.operationsSummary.query.latencyMillis.p100;
            obj.queryThroughput0 = metrics_json.testResults.operationsSummary.query.requestsPerSecond.p0;
            obj.queryThroughput50 = metrics_json.testResults.operationsSummary.query.requestsPerSecond.p50;
            obj.queryThroughput100 = metrics_json.testResults.operationsSummary.query.requestsPerSecond.p100;
            obj.queryOperationOpsCount = metrics_json.testResults.operationsSummary.query.opCount;
            obj.queryOperationErrCount = metrics_json.testResults.operationsSummary.query.opErrorCount;
            obj.queryOperationErrRate = metrics_json.testResults.operationsSummary.query.opErrorRate;
            obj.cpu50 = metrics_json.testResults.cpuStats.overall.p50;
            obj.cpu90 = metrics_json.testResults.cpuStats.overall.p90;
            obj.cpu99 = metrics_json.testResults.cpuStats.overall.p99;
            obj.cpu100 = metrics_json.testResults.cpuStats.overall.p100;
            obj.memory50 = metrics_json.testResults.memoryStats.overall.p50;
            obj.memory90 = metrics_json.testResults.memoryStats.overall.p90;
            obj.memory99 = metrics_json.testResults.memoryStats.overall.p99;
            obj.memory100 = metrics_json.testResults.memoryStats.overall.p100;
            obj.gcOld = metrics_json.testResults.garbageCollection.overall.oldGCTimeMillis;
            obj.gcYoung = metrics_json.testResults.garbageCollection.overall.youngGCTimeMillis;
            
        } catch (e) {
            console.log(e);
        }
    }
    else{ // still running
        obj.running = 'Running';
    }

    return obj;
}


// create perf number folder, attempt to download JSON.
async function perf_dl(url, folder_name, perf_num, sec, ejs_pass){

    fs.mkdirSync(`${folder_name}/${perf_num.number}/${sec}`, {recursive: true});

    // fetch JSON
    let url_resp = await fetch(url);

    if (!url_resp.ok){ // if fetch failed (only considering 403 right now)

        if(url_resp.status === 403){
            // add the marker folder JSON_403 for future reference
            fs.mkdirSync(`${folder_name}/${perf_num.number}/${sec}/JSON_403`);
        }

    } else{ // if fetch succeeded

        // write JSON into file, with some additional properties added
        let metrics_json = await url_resp.json();
        metrics_json.architecture = perf_num.architecture;
        metrics_json.version = perf_num.version;
        metrics_json.result = perf_num.result;
        metrics_json.buildNumber = perf_num.buildNumber;

        let path = `${folder_name}/${perf_num.number}/${sec}/perf.json`;
        fs.writeFileSync(path, JSON.stringify(metrics_json, null, 2) , 'utf-8');
        
    }
}