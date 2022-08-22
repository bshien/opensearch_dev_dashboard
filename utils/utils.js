const fs = require('fs');
const https = require('https');
const fetch = require('node-fetch');
const miki_json = require('../miki.json')

const build_num_set = {};
const dashboard_build_num_set = {};

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
    return 'https://build.ci.opensearch.org/job/distribution-build-opensearch' + dashboards + '/' + build_num + '/artifact/commits.yml';
}

exports.create_yml_url = create_yml_url;

function check_delete(build_nums, folder_name, page){
    let set = build_num_set;
    if(page === 'dashboards'){
        set = dashboard_build_num_set;
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
        let path = `${__dirname}/../${folder_name}/${build_num}/commits.yml`; 
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


async function dl_perf(res){
    let builds_url = 'https://ci.opensearch.org/ci/dbc/perf-test/1.2.4/762/linux/x64/test-results/perf-test/without-security/2caaa49a-3af7-438e-a090-7cf39f59a599.json';
    let jobs = await fetch(builds_url);
    let jobs_json = await jobs.json();
    // console.log(jobs_json);
    res.render('perf', {json: jobs_json});
}

exports.dl_perf = dl_perf;

function html_parse(req, old_res){
    https.get('https://build.ci.opensearch.org/job/integ-test/2683/flowGraphTable/',(res) => {
        let body = "";
        res.on('readable', function() {
            body += res.read();
        });
        res.on('end', function() {
            //console.log(body);
            //console.log("OK"); 

            // const re = new RegExp('<td>Error running integtest for component \w*</td>', 'g');
            const re1 = new RegExp('<td>Error running integtest for component ([a-zA-Z-]*)</td>', 'g');
            //const re2 = new RegExp('<td>componentList: \[([-a-zA-Z, ]*)\]<\/td>', 'g');
            const re2 = /<td>componentList: \[([-a-zA-Z, ]*)\]<\/td>/;
            const re3 = new RegExp('<td>Completed running integtest for component ([a-zA-Z-]*)</td>', 'g');

            const compList = body.match(re2)[1].split(', ');
            let compObjs = [];
            compList.forEach(comp => {
                compObjs.push({name: comp})
            });
            //console.log(compObjs);
            compErrors_array = [];
            compFins_array = [];
            const compError = [...body.matchAll(re1)];
            //console.log(compError);
            // compError.forEach(s => console.log(s[1]));
            compError.forEach(s => compErrors_array.push(s[1]));

            const compFin = [...body.matchAll(re3)];
            //console.log(compFin);
            //compFin.forEach(s => console.log(s[1]));
            compFin.forEach(s => compFins_array.push(s[1]));

            compObjs.forEach(comp =>{
                comp.log = `https://ci.opensearch.org/ci/dbc/integ-test/${req.params.version}/${req.params.build_number}/linux/x64/tar/test-results/1/integ-test/${comp.name}/with-security/test-results/${comp.name}.yml`
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

            // dummy data
            // for(let i = 0; i < compObjs.length; i++){
            //     compObjs[i].result = 'SUCCESS';
            //     if(i > (compObjs.length / 3)){
            //         if(i % 3 == 0){
            //             compObjs[i].result = 'FAILURE';
            //         }
            //     }
            //     if(i < (compObjs.length / 3)){
            //         if(i % 2 == 0){
            //             compObjs[i].result = 'FAILURE';
            //         }
            //     }
            // }

            old_res.render('integ', {compObjs: compObjs});
        });
    });
}

exports.html_parse = html_parse;

function dashboard_parse(req, old_res){
    https.get('https://ci.opensearch.org/ci/dbc/integ-test-opensearch-dashboards/2.1.0/4011/linux/x64/tar/test-results/1/integ-test/functionalTestDashboards/without-security/test-results/stdout.txt',(res) => {
        let body = "";
        res.on('readable', function() {
            body += res.read();
        });
        res.on('end', function() {
            // console.log(body);
            // console.log("OK"); 
            

            // const re = new RegExp('<td>Error running integtest for component \w*</td>', 'g');
            //const re1 = /\u2714  plugins/[-a-zA-Z ]*\//g;
            const re1 = /\u2714  plugins\/([-a-zA-Z ]*)\//g;
            const re2 = /\u2716  plugins\/([-a-zA-Z ]*)\//g;
            // const re2 = /<td>componentList: \[([-a-zA-Z, ]*)\]<\/td>/;
            // const re3 = new RegExp('<td>Completed running integtest for component ([a-zA-Z-]*)</td>', 'g');

            let compObjs = [];
            let plugin_status = {};
            let passed_plugins_obj = {}
            let failed_plugins_obj = {}
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
            keys.forEach(key => compObjs.push({name: key, result: plugin_status[key]}));
            

            old_res.render('integ', {compObjs: compObjs});
        });
    });
}

exports.dashboard_parse = dashboard_parse;