const fs = require('fs');
const https = require('https');
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const miki_json = require('../miki.json')

const build_num_set = {};
const perf_num_set = {};
const dashboard_build_num_set = {};
const NUM_OF_PERFS = 10;

exports.build_num_set = build_num_set;
exports.dashboard_build_num_set = dashboard_build_num_set;

function parse_miki(){
    let map = {};
    miki_json.forEach(obj => {
        map[obj.repo] = obj.name;
    });
    return map;
}

exports.parse_miki = parse_miki;

function start_date_convert(ms){
    const date = new Date(ms);
    return date.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        dateStyle: 'short',
        timeStyle: 'short',
        
    });   
}

exports.start_date_convert = start_date_convert;

function change_formatting(str){
    if(str === 'k-NN'){
        return str + ': OpenSearch Plugin';
    }
    if(str === 'ml-commons'){
        return 'Machine Learning Commons';
    }
    let splitStr = str.split('-');
    for (let i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
    }
    return splitStr.join(' ') + ': OpenSearch Plugin'; 
}

exports.change_formatting = change_formatting;

function create_artifact_url(build_num, version, architecture, type, dashboards){
    return 'https://ci.opensearch.org/ci/dbc/distribution-build-opensearch' + dashboards +'/' + version + '/' + build_num + '/linux/' + architecture + '/' + type
    + '/dist/opensearch/opensearch-' + version + '-linux-' + architecture + '.' + type + (type === 'tar' ? '.gz' : '');
}

exports.create_artifact_url = create_artifact_url;

function create_yml_url(build_num, dashboards){
    return 'https://build.ci.opensearch.org/job/distribution-build-opensearch' + dashboards + '/' + build_num + '/artifact/buildInfo.yml';
}

exports.create_yml_url = create_yml_url;

function check_delete(folder_name, page){
    let set = build_num_set;
    if(page === 'dashboards'){
        set = dashboard_build_num_set;
    }
    if(page === 'perf'){
        set = perf_num_set;
    }
    fs.readdir(folder_name, (err, files) => {
        files.forEach(file => {
            console.log(file, ' exists');
            if(!(file in set)){
                fs.rmSync(`${folder_name}/${file}`, { recursive: true, force: true });
                console.log(file, ' deleted');

            }
        });
    });
}

exports.check_delete = check_delete;


function download_yml(yml_url, build_num, folder_name){
    https.get(yml_url,(res) => {
        let path = `${__dirname}/../${folder_name}/${build_num}/buildInfo.yml`; 
        const filePath = fs.createWriteStream(path, {flags: 'w+'});
        res.pipe(filePath);
        filePath.on('finish',() => {
            filePath.close();
            console.log('yml Download Completed');
            if(res.statusCode === 404){
                // fs.rmSync(`build_ymls/${build_num}`, { recursive: true, force: true });
                // console.log(build_num, ' deleted');
                fs.mkdir(folder_name + '/' + build_num + '/ABORTED', (err)=>{
                    if(err){
                        console.log(err);
                    }
                    else{
                        console.log(`Directory ${build_num}/ABORTED created`);
                    }
                });
            }
        })
    })
}

exports.download_yml = download_yml;

function yml_exists(build_num, page){
    if(page === 'dashboards'){
        return fs.existsSync('dashboard_build_ymls/' + build_num.toString());
    }
    return fs.existsSync('build_ymls/' + build_num.toString());
}

exports.yml_exists = yml_exists;

function convert_build_duration(ms){
    let s = ms/1000;
    let m = s / 60;
    let h = m / 60;
    if(Math.trunc(h) > 0){
        return `${Math.trunc(h)}h ${Math.trunc(m%60)}m ${Math.trunc(s%60)}s`;
    }
    if(Math.trunc(m) > 0){
        return `${Math.trunc(m)}m ${Math.trunc(s%60)}s`;
    }
    return `${Math.trunc(s)}s`; 
}

exports.convert_build_duration = convert_build_duration;




async function html_parse(url, integ_num, architecture, req, old_res){
    const response = await fetch(url);
    const body = await response.text();

    // console.log(url, body);

    const re1 = new RegExp('<td>Error running integtest for component ([a-zA-Z-]*)</td>', 'g');
    const re2 = /<td>componentList: \[([-a-zA-Z, ]*)\]<\/td>/;
    const re3 = new RegExp('<td>Completed running integtest for component ([a-zA-Z-]*)</td>', 'g');
    const err_re = /Integration Tests failed to start./;

    if(body.match(err_re)){
        return [];
    }

    // let match = body.match(re2);
    // const compList = [];
    // if(match){
    //     compList = match[1].split(', ');
    // }
    
    const compList = body.match(re2)[1].split(', ');

    let compObjs = [];

    compList.forEach(comp => {
        compObjs.push({name: comp})
    });

    compErrors_array = [];
    compFins_array = [];
    const compError = [...body.matchAll(re1)];
    compError.forEach(s => compErrors_array.push(s[1]));

    const compFin = [...body.matchAll(re3)];
    compFin.forEach(s => compFins_array.push(s[1]));

    let security_map = new Map();
    try{
        yml_json = yaml.load(fs.readFileSync(`build_ymls/${req.params.build_number}/testManifest.yml`, 'utf8'));
        // console.log('yml jseen', yml_json);
        yml_json.components.forEach(comp => {
            security_map.set(comp.name, comp['integ-test']['test-configs']);
        });
        // console.log(security_map);
        
    } catch(err) {
        console.log('testManifest.yml error:', err);

    }
    compObjs.forEach(comp =>{
        //console.log(security_map);
        if(security_map.has(comp.name)){
            // console.log(security_map.get(comp.name));
            if(security_map.get(comp.name)?.includes('with-security')){
                comp.logWithSecurity = `https://ci.opensearch.org/ci/dbc/integ-test/${req.params.version}/${req.params.build_number}/linux/${architecture}/tar/test-results/${integ_num}/integ-test/${comp.name}/with-security/test-results/${comp.name}.yml`
            }
            if(security_map.get(comp.name)?.includes('without-security')){
                comp.logWithoutSecurity = `https://ci.opensearch.org/ci/dbc/integ-test/${req.params.version}/${req.params.build_number}/linux/${architecture}/tar/test-results/${integ_num}/integ-test/${comp.name}/without-security/test-results/${comp.name}.yml`
            }
        }
        // comp.log = `https://ci.opensearch.org/ci/dbc/integ-test/${req.params.version}/${req.params.build_number}/linux/${architecture}/tar/test-results/1/integ-test/${comp.name}/with-security/test-results/${comp.name}.yml`
        if(compFins_array.includes(comp.name)){
            comp.result = 'SUCCESS';
            if(compErrors_array.includes(comp.name)){
                comp.result = 'FAILURE';
            }              
        }
        else{
            comp.result = "DNF";
        } 
    });

    // old_res.render('integ', {compObjs: compObjs});
    return compObjs;
     
}

exports.html_parse = html_parse;


async function dashboard_parse(url, architecture, req, old_res){

    const response = await fetch(url);
    const body = await response.text();

    
    
    const re1 = /\u2714  plugins\/([-a-zA-Z ]*)\//g;
    const re2 = /\u2716  plugins\/([-a-zA-Z ]*)\//g;

    let compObjs = [];
    let plugin_status = {};
    // let passed_plugins_obj = {}
    // let failed_plugins_obj = {}
    const comp_match_success = [...body.matchAll(re1)];
    comp_match_success.forEach(plugin => {
        //compObjs.push({name: plugin[1], result: 'SUCCESS'});
        plugin_status[plugin[1]] = 'SUCCESS';
    });

    const comp_match_failed = [...body.matchAll(re2)];
    comp_match_failed.forEach(plugin => {
        plugin_status[plugin[1]] = 'FAILURE';       
    });

    // console.log(comp_match_failed);

    let keys = Object.keys(plugin_status);
    keys.forEach(key => compObjs.push({name: key, result: plugin_status[key], architecture: architecture}));
    
    return compObjs;
    
}

exports.dashboard_parse = dashboard_parse;

async function dl_perf(res){
    let builds_url = 'https://ci.opensearch.org/ci/dbc/perf-test/1.2.4/762/linux/x64/test-results/perf-test/without-security/2caaa49a-3af7-438e-a090-7cf39f59a599.json';
    let jobs = await fetch(builds_url);
    let jobs_json = await jobs.json();
    // console.log(jobs_json);
    res.render('perf', {json: jobs_json});
}

exports.dl_perf = dl_perf;

async function perf_fetch(res){

    // init
    let perf_url = 'https://build.ci.opensearch.org/job/perf-test/';
    let folder_name = 'perf_jsons';
    let page = 'perf';
    let jobs = await fetch(perf_url + '/api/json');
    let jobs_json = await jobs.json();
    perf_nums = []
    ejs_pass = [] // passing to ejs for render

    // loop through past X performance tests, add their number to an object
    for(let i = 0; i < NUM_OF_PERFS; i++){
        perf_nums.push({number: jobs_json.builds[i].number});
        perf_num_set[jobs_json.builds[i].number.toString()] = null; // for deleting old perf_jsons folders
    }
    console.log(perf_nums);
    
    // for each performance test number
    for(const perf_num of perf_nums){

        // if performance number folder exists
        if(fs.existsSync('perf_jsons/' + perf_num.number.toString())){
            console.log(perf_num.number.toString() + "exists(not check_delete)");
            ejs_pass.push(create_perf_obj(perf_num, 'with_security'));
            ejs_pass.push(create_perf_obj(perf_num, 'without_security'));
        }
        else { // if doesn't exist

            // make more specific jenkins API call
            let new_url = perf_url + '/' + perf_num.number.toString() + '/api/json';
            let specific_perf = await fetch(new_url);
            let perf_json = await specific_perf.json();

            // regex for getting version, build number, and architecture from JSON property: description.
            const version_re = /[0-9].[0-9].[0-9]/;
            const build_no_re = /Running performance test for build number: ([0-9]*) /;
            const architecture_re = /https:\/\/ci.opensearch.org\/ci\/dbc\/distribution-build-opensearch\/[0-9].[0-9].[0-9]\/latest\/linux\/([a-zA-Z0-9]+)\/tar\/dist\/opensearch\/manifest.yml/;
            
            // add properties for later display
            perf_num.version = perf_json.description?.match(version_re)[0];
            perf_num.buildNumber = perf_json.description?.match(build_no_re)[1];
            perf_num.architecture = perf_json.description?.match(architecture_re)[1];
            
            perf_num.result = perf_json.result;
            perf_num.running = perf_json.building ? "Running" : "Done";
            
            // if performance test is not still running
            if(!perf_json.building){
                    
                console.log(`Directory ${perf_num.number} created`);

                //create url and download json into build num folder
                let url_with = `https://ci.opensearch.org/ci/dbc/perf-test/${perf_num.version}/${perf_num.buildNumber}/linux/${perf_num.architecture}/tar/test-results/${perf_num.number}/perf-test/with-security/perf-test.json`;
                let url_without = `https://ci.opensearch.org/ci/dbc/perf-test/${perf_num.version}/${perf_num.buildNumber}/linux/${perf_num.architecture}/tar/test-results/${perf_num.number}/perf-test/without-security/perf-test.json`;
                
                perf_dl(url_with, folder_name, perf_num, 'with_security');
                perf_dl(url_without, folder_name, perf_num, 'without_security');
                
            } else { // perf test still running

                // fs.mkdirSync(`${folder_name}/${perf_num.number}/with_security/BUILDING`, {recursive: true});
                // fs.mkdirSync(`${folder_name}/${perf_num.number}/without_security/BUILDING`, {recursive: true});
                ejs_pass.push(create_perf_obj(perf_num, 'with_security'));
                ejs_pass.push(create_perf_obj(perf_num, 'without_security'));
            }
            
        }
        
    }
    //console.log(build_nums);
    check_delete(folder_name, page);

    // console.log('ejs pass', ejs_pass);
    // for(const print of ejs_pass){
    //     console.log(JSON.stringify(print));
    // }
    
    res.render(page, {perf_nums: ejs_pass}); 
    

}

exports.perf_fetch = perf_fetch;

// Takes in a perf test number, and returns an array of json for [x64-with, x64without, arm64with, arm64without]
function create_perf_obj(perf_num, security){
    console.log(perf_num.number);
    // let ret = [];
    // let perf_names = ['x64_with' , 'x64_without', 'arm64_with', 'arm64_without'];
    // let perf_names = ['with_security' , 'without_security'];

    let obj = {number: perf_num.number};
    obj.running = 'Running';

    if(fs.existsSync(`perf_jsons/${perf_num.number}/${security}/JSON_403`)){
        obj.result = 'JSON 403';
        console.log("Did 403");
    } 
    else {
        try {
            obj = {number: perf_num.number, running: perf_num.running, version: perf_num.version, security_enabled: security, architecture: perf_num.architecture}
            
            const metrics_json = JSON.parse(fs.readFileSync(`perf_jsons/${perf_num.number}/${security}/perf.json`));
            // console.log('metrics_json: ', metrics_json);
            obj.version = metrics_json.version;
            obj.architecture = metrics_json.architecture;
            obj.running = 'Done';
            obj.result = metrics_json.result;
            obj.buildNumber = metrics_json.buildNumber;
            obj.startTime = start_date_convert(metrics_json.testResults.testStartTime);
            obj.duration = convert_build_duration(metrics_json.testResults.testDuration);

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


            console.log("Actually didn't 403");
            
        } catch (e) {
            console.log(e);
        }
    }
    return obj;
}


// create perf num folder, attempt to download perf json.

async function perf_dl(url, folder_name, perf_num, sec){
    fs.mkdirSync(`${folder_name}/${perf_num.number}/${sec}`, {recursive: true});
    let path = `${folder_name}/${perf_num.number}/${sec}/perf.json`;
    let url_resp = await fetch(url);
    if (!url_resp.ok){
        if(url_resp.status === 403){
            fs.mkdirSync(`${folder_name}/${perf_num.number}/${sec}/JSON_403`);
            console.log(`Directory ${perf_num.number}/${sec}/JSON_403 created`);
        }
    } else{
        let metrics_json = await url_resp.json();
        metrics_json.architecture = perf_num.architecture;
        metrics_json.version = perf_num.version;
        metrics_json.result = perf_num.result;
        metrics_json.buildNumber = perf_num.buildNumber;
        fs.writeFileSync(path, JSON.stringify(metrics_json, null, 2) , 'utf-8');
        ejs_pass.push(create_perf_obj(perf_num, sec));
    }

}