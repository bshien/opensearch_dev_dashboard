// imports
const fs = require('fs');
const https = require('https');
const fetch = require('node-fetch');
const yaml = require('js-yaml');

// converts start date from ms to a displayable time, in Pacific
function start_date_convert(ms){
    const date = new Date(ms);
    return date.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        dateStyle: 'short',
        timeStyle: 'short',
        
    });   
}

exports.start_date_convert = start_date_convert;

// Creates the artifact link
function create_artifact_url(build_num, version, architecture, type, dashboards){
    return 'https://ci.opensearch.org/ci/dbc/distribution-build-opensearch' + dashboards +'/' + version + '/' + build_num + '/linux/' + architecture + '/' + type
    + '/dist/opensearch' + dashboards + '/opensearch' + dashboards + '-' + version + '-linux-' + architecture + '.' + type + (type === 'tar' ? '.gz' : '');
}

exports.create_artifact_url = create_artifact_url;

// Creates the link to download buildInfo.yml
function create_yml_url(build_num, dashboards){
    return 'https://build.ci.opensearch.org/job/distribution-build-opensearch' + dashboards + '/' + build_num + '/artifact/buildInfo.yml';
}

exports.create_yml_url = create_yml_url;

// Handles the deletion of old build number folders in the cache.
// I use it for all three cache folders: build_ymls, dashboards_build_ymls, and perf_jsons
function check_delete(folder_name, set){
    fs.readdir(folder_name, (err, files) => {
        files.forEach(file => {
            if(!(file in set)){
                fs.rmSync(`${folder_name}/${file}`, { recursive: true, force: true });
            }
        });
    });
}

exports.check_delete = check_delete;

// Downloads buildInfo.yml, better way to do it would be to use fetch.
function download_yml(yml_url, build_num, folder_name){
    https.get(yml_url,(res) => {
        let path = `${__dirname}/../${folder_name}/${build_num}/buildInfo.yml`; 
        const filePath = fs.createWriteStream(path, {flags: 'w+'});
        res.pipe(filePath);
        filePath.on('finish',() => {
            filePath.close();
            if(res.statusCode === 404){
                fs.mkdir(folder_name + '/' + build_num + '/ABORTED', (err)=>{
                    if(err){
                        console.log(err);
                    }
                });
            }
        })
    })
}

exports.download_yml = download_yml;

// Returns true if the build number folder exists, false if not
function yml_exists(build_num, page){
    if(page === 'dashboards'){
        return fs.existsSync('dashboard_build_ymls/' + build_num.toString());
    }
    return fs.existsSync('build_ymls/' + build_num.toString());
}

exports.yml_exists = yml_exists;

// Converts the duration from ms to a displayable format
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


// Integ parsing for OpenSearch, returns a list of objects with data to be displayed
async function html_parse(url, integ_num, architecture, req){

    const response = await fetch(url);

    // if the fetch errored out, return an empty object
    if(!response.ok){
        return [];
    }

    const body = await response.text();

    // Regex for component list, error, completed
    const re1 = /<td>componentList: \[([-a-zA-Z, ]*)\]<\/td>/;
    const re2 = new RegExp('<td>Error running integtest for component ([a-zA-Z-]*)</td>', 'g');
    const re3 = new RegExp('<td>Completed running integtest for component ([a-zA-Z-]*)</td>', 'g');
    const err_re = /Integration Tests failed to start./;

    // if error, return empty obj
    if(body.match(err_re)){
        return [];
    }

    const compList = body.match(re1)[1].split(', ');
    let compObjs = [];
    compList.forEach(comp => {
        compObjs.push({name: comp})
    });

    // set of components that errored out
    compErrors = new Set()
    const compError = [...body.matchAll(re2)];
    compError.forEach(s => compErrors.add(s[1]));

    // set of components that finished
    compFins = new Set();
    const compFin = [...body.matchAll(re3)];
    compFin.forEach(s => compFins.add(s[1]));

    // create a mapping between component name and whether they have with and/or without security integ tests(in a list)
    let security_map = new Map();
    try{
        yml_json = yaml.load(fs.readFileSync(`build_ymls/${req.params.build_number}/testManifest.yml`, 'utf8'));
      
        yml_json.components.forEach(comp => {
            security_map.set(comp.name, comp['integ-test']['test-configs']);
        });
        
    } catch(err) {
        console.log('testManifest.yml error:', err);
    }


    compObjs.forEach(comp =>{
        if(compFins.has(comp.name)){
            comp.result = 'SUCCESS';
            if(compErrors.has(comp.name)){
                comp.result = 'FAILURE';
            }              
        }
        else{
            comp.result = "DNF";
        } 

        if(security_map.has(comp.name)){
            if(security_map.get(comp.name)?.includes('with-security')){
                comp.logWithSecurity = `https://ci.opensearch.org/ci/dbc/integ-test/${req.params.version}/${req.params.build_number}/linux/${architecture}/tar/test-results/${integ_num}/integ-test/${comp.name}/with-security/test-results/stdout.txt`
            }
            if(security_map.get(comp.name)?.includes('without-security')){
                comp.logWithoutSecurity = `https://ci.opensearch.org/ci/dbc/integ-test/${req.params.version}/${req.params.build_number}/linux/${architecture}/tar/test-results/${integ_num}/integ-test/${comp.name}/without-security/test-results/stdout.txt`
            }
            
        } else{
            comp.result = 'N/A';
        }
    });
    return compObjs;
}

exports.html_parse = html_parse;


async function dashboard_parse(url, architecture){

    const response = await fetch(url);

    // if the fetch errored out, return an empty object
    if(!response.ok){
        return [];
    }

    const body = await response.text();
    
    // regex for the check and the x
    const re1 = /\u2714  plugins\/([-a-zA-Z ]*)\//g;
    const re2 = /\u2716  plugins\/([-a-zA-Z ]*)\//g;

    // for cases where plugin name too long in the log, it's split into different lines with
    // a bunch of whitespace and other info in between. This is kind of a hacky solution.
    
    const re1_1 = /\u2714  plugins\/([-a-zA-Z ]{27})[\s\S]{66}([-a-zA-Z ]*)\//g;
    const re2_1 = /\u2716  plugins\/([-a-zA-Z ]{27})[\s\S]{66}([-a-zA-Z ]*)\//g;

    let compObjs = [];
    let plugin_status = {}; // Object with 

    const comp_match_success = [...body.matchAll(re1)];
    comp_match_success.forEach(plugin => {
        plugin_status[plugin[1]] = 'SUCCESS';
    });

    const comp_match_success_1 = [...body.matchAll(re1_1)];
    comp_match_success_1.forEach(plugin => {
        plugin_status[plugin[1]+plugin[2]] = 'SUCCESS';
    });

    const comp_match_failed = [...body.matchAll(re2)];
    comp_match_failed.forEach(plugin => { 
        plugin_status[plugin[1]] = 'FAILURE';       
    });

    const comp_match_failed_1 = [...body.matchAll(re2_1)];
    comp_match_failed_1.forEach(plugin => {
        plugin_status[plugin[1]+plugin[2]] = 'FAILURE';
    });

    let keys = Object.keys(plugin_status);
    keys.forEach(key => compObjs.push({name: key, result: plugin_status[key], architecture: architecture}));
    
    return compObjs;
    
}

exports.dashboard_parse = dashboard_parse;
