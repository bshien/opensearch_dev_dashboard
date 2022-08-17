// import
const fetch = require('node-fetch');
const express = require('express');
const http = require('http');
const https = require('https');
const yaml = require('js-yaml');
const fs = require('fs');
const utility = require('./utils/utils');

// init
const app = express();
const port = process.env.PORT || 3000;

const NUM_OF_BUILDS = 30;
let build_nums = [];

async function fetchh(res, page){
    let builds_url = 'https://build.ci.opensearch.org/job/distribution-build-opensearch';
    let folder_name = 'build_ymls';
    if(page === 'dashboards'){
        builds_url = 'https://build.ci.opensearch.org/job/distribution-build-opensearch-dashboards/';
        folder_name = 'dashboard_build_ymls';

    }
    let url_add = (page === 'dashboards') ? '-dashboards' : '';
    //let jobs = await fetch('https://build.ci.opensearch.org/job/distribution-build-opensearch/api/json?tree=allBuilds[number,url]');
    let jobs = await fetch(builds_url + '/api/json');

    let jobs_json = await jobs.json();
    build_nums = []
    for(let i = 0; i < NUM_OF_BUILDS; i++){
        build_nums.push({build_num: jobs_json.builds[i].number});
        if(page === 'index'){
            utility.build_num_set[jobs_json.builds[i].number.toString()] = null;
        }
        else if(page ==='dashboards'){
            utility.dashboard_build_num_set[jobs_json.builds[i].number.toString()] = null;
        }
    }

    console.log(build_nums);

    for(let i = 0; i < NUM_OF_BUILDS; i++){
        if(utility.yml_exists(build_nums[i].build_num, page)){
            build_nums[i].running = 'Done';
            if(fs.existsSync(`${folder_name}/${build_nums[i].build_num}/ABORTED`)){
                build_nums[i].result = 'ABORTED';
            } else {
                try {
                    const yml_json = yaml.load(fs.readFileSync(`${folder_name}/${build_nums[i].build_num}/commits.yml`, 'utf8'));
                    //console.log(yml_json);
                    build_nums[i].version = yml_json.build.version;
                } catch (e) {
                    console.log(e);
                }
            }
            

        }
        else {
            let new_url = builds_url + '/' + build_nums[i].build_num.toString() + '/api/json';
            //console.log(new_url);
            let specific_build = await fetch(new_url);
            let build_json = await specific_build.json();
            //console.log(build_json);
            if(!build_json.building){
                fs.mkdir(`${folder_name}/` + build_nums[i].build_num.toString(), (err)=>{
                    if(err){
                        console.log(err);
                    }
                    else{
                        console.log(`Directory ${build_nums[i].build_num} created`);
                        utility.download_yml(utility.create_yml_url(build_nums[i].build_num, url_add), build_nums[i].build_num, folder_name);
                    }
                });
                

            }
            build_nums[i].result = build_json.result;
            build_nums[i].version = build_json.description?.slice(0, build_json.description.indexOf("/"));
            build_nums[i].running = build_json.building ? "Running" : "Done";
            const date = new Date(build_json.timestamp);
            build_nums[i].start_time = date.toLocaleString('en-US', {
                timeZone: 'America/Los_Angeles',
                dateStyle: 'short',
                timeStyle: 'short',
                
            });
            build_nums[i].duration = utility.convert_build_duration(build_json.duration);
            
        }
        build_nums[i].x64_tar = utility.create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'x64', 'tar', url_add);
        build_nums[i].arm64_tar = utility.create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'arm64', 'tar', url_add);
        build_nums[i].x64_rpm = utility.create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'x64', 'rpm', url_add);
        build_nums[i].arm64_rpm = utility.create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'arm64', 'rpm', url_add);
    }
    //console.log(build_nums);
    utility.check_delete(build_nums, folder_name, page);
    res.render(page, {builds_array: build_nums, NUM_OF_BUILDS: NUM_OF_BUILDS}); 
}

app.use(express.static(__dirname + '/public'));

app.set('view engine', 'ejs');  

app.get('/', function(req, res){
    fetchh(res, 'index');
});

app.get('/dashboards', function(req, res){
    fetchh(res, 'dashboards');
})

app.get('/commits/:build_number-:dashboard', function(req, res){
    // change_manifest_url(req.params.build_number, req.params.version);
    // download_manifest(manifest_url, res);
    let yml_json = null;
    if(req.params.dashboard === 'd'){
        yml_json = yaml.load(fs.readFileSync(`dashboard_build_ymls/${req.params.build_number}/commits.yml`, 'utf8'));
    }
    else{
        yml_json = yaml.load(fs.readFileSync(`build_ymls/${req.params.build_number}/commits.yml`, 'utf8'));
    }
    res.render('commits', {yml_json: yml_json});
    
})

app.get('/CVE/:build_number-:dashboard', function(req, res){
    // change_manifest_url(req.params.build_number, req.params.version);
    // download_manifest(manifest_url, res);
    //const yml_json = yaml.load(fs.readFileSync(`build_ymls/${req.params.build_number}/commits.yml`, 'utf8'));
    let yml_json = null;
    if(req.params.dashboard === 'd'){
        yml_json = yaml.load(fs.readFileSync(`dashboard_build_ymls/${req.params.build_number}/commits.yml`, 'utf8'));
    }
    else{
        yml_json = yaml.load(fs.readFileSync(`build_ymls/${req.params.build_number}/commits.yml`, 'utf8'));
    }
    res.render('CVE', {yml_json: yml_json, change_formatting: utility.change_formatting});
    
})


app.get('/integ/:build_number-:version', function(req, res){
    old_res = res;

    https.get('https://build.ci.opensearch.org/job/integ-test/2683/flowGraphTable/',(res) => {
        var body = "";
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

            old_res.render('integ', {compObjs: compObjs});
        });
    });
})



app.get('/perf', function(req, res){
    utility.dl_perf(res);
})


app.listen(port, function(){
    console.log(`Example app listening on ${port}!`);
});

