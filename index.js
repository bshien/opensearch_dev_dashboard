// import
const fetch = require('node-fetch');
const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');

const advisories = require('./utils/advisories');
const utility = require('./utils/utils');
const perf_utils = require('./utils/perf_utils.js');


// init
const app = express();
const port = process.env.PORT || 3000;
const NUM_OF_BUILDS = 50;
// let build_nums = [];

async function fetchh(res, page){
    let build_num_set = {};
    let builds_url = 'https://build.ci.opensearch.org/job/distribution-build-opensearch';
    let folder_name = 'build_ymls';
    if(page === 'dashboards'){
        builds_url = 'https://build.ci.opensearch.org/job/distribution-build-opensearch-dashboards/';
        folder_name = 'dashboard_build_ymls';
    }
    let url_add = (page === 'dashboards') ? '-dashboards' : '';
    let jobs = await fetch(builds_url + '/api/json');

    let jobs_json = await jobs.json();
    let build_nums = [];
    for(let i = 0; i < NUM_OF_BUILDS; i++){
        build_nums.push({build_num: jobs_json.builds[i].number});

        build_num_set[jobs_json.builds[i].number.toString()] = null;      
    }

    for(let i = 0; i < NUM_OF_BUILDS; i++){
        if(utility.yml_exists(build_nums[i].build_num, page)){
            build_nums[i].running = 'Done';
            if(fs.existsSync(`${folder_name}/${build_nums[i].build_num}/ABORTED`)){
                build_nums[i].result = 'ABORTED';
            } else {
                try {
                    const yml_json = yaml.load(fs.readFileSync(`${folder_name}/${build_nums[i].build_num}/buildInfo.yml`, 'utf8'));
                    
                    build_nums[i].version = yml_json.build.version;
                    build_nums[i].result = yml_json.build.status;
                    build_nums[i].start_time = utility.start_date_convert(yml_json.results.startTimestamp);
                    build_nums[i].duration = utility.convert_build_duration(yml_json.results.duration);
                    build_nums[i].integ = {};
                    build_nums[i].integ.x64 = yml_json.results.integ_test_x64;
                    build_nums[i].integ.arm64 = yml_json.results.integ_test_arm64;
                    
                } catch (e) {
                    console.log(e);
                }
            }

            
            

        }
        else {
            let new_url = builds_url + '/' + build_nums[i].build_num.toString() + '/api/json';

            let specific_build = await fetch(new_url);
            let build_json = await specific_build.json();

            build_nums[i].result = build_json.result;
            build_nums[i].version = build_json.description?.slice(0, build_json.description.indexOf("/"));
            build_nums[i].running = build_json.building ? "Running" : "Done";
            build_nums[i].start_time = utility.start_date_convert(build_json.timestamp);
            build_nums[i].duration = utility.convert_build_duration(build_json.duration);

            if(!build_json.building){
                fs.mkdirSync(`${folder_name}/` + build_nums[i].build_num.toString());
                
                utility.download_yml(utility.create_yml_url(build_nums[i].build_num, url_add), build_nums[i].build_num, folder_name);
                
                // download test manifest yml
                let test_manifest_resp = await fetch(`https://raw.githubusercontent.com/opensearch-project/opensearch-build/main/manifests/${build_nums[i].version}/opensearch${url_add}-${build_nums[i].version}-test.yml`);
                if(test_manifest_resp.ok){
                    let body = await test_manifest_resp.text();
                    fs.writeFileSync(`${folder_name}/${build_nums[i].build_num}/testManifest.yml`, body , 'utf-8');
                            
                }

            }
      
        }
        build_nums[i].x64_tar = utility.create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'x64', 'tar', url_add);
        build_nums[i].arm64_tar = utility.create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'arm64', 'tar', url_add);
        build_nums[i].x64_rpm = utility.create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'x64', 'rpm', url_add);
        build_nums[i].arm64_rpm = utility.create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'arm64', 'rpm', url_add);
    }
    
    utility.check_delete(folder_name, build_num_set);
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
    let yml_json = null;
    if(req.params.dashboard === 'd'){
        yml_json = yaml.load(fs.readFileSync(`dashboard_build_ymls/${req.params.build_number}/buildInfo.yml`, 'utf8'));
    }
    else if(req.params.dashboard === 'nd'){
        yml_json = yaml.load(fs.readFileSync(`build_ymls/${req.params.build_number}/buildInfo.yml`, 'utf8'));
    }
    res.render('commits', {components: yml_json.components});
    
})

app.get('/CVE/:build_number-:dashboard', function(req, res){

    let yml_json = null;

    if(req.params.dashboard === 'd'){
        yml_json = yaml.load(fs.readFileSync(`dashboard_build_ymls/${req.params.build_number}/buildInfo.yml`, 'utf8'));
    }
    else if(req.params.dashboard === 'nd'){
        yml_json = yaml.load(fs.readFileSync(`build_ymls/${req.params.build_number}/buildInfo.yml`, 'utf8'));
    }

    let advisory_mapping = new Map();
    for(const component of yml_json.components){
        advisory_mapping.set(component.name, advisories.getURLForRepository(component.repository));
    }

    res.render('CVE', {advisory_mapping: advisory_mapping});
    
})


app.get('/integ/:build_number-:version-:x64_num?-:arm64_num?-:dashboard', async function(req, res){
    if(req.params.dashboard === 'nd'){
        let x64_url = `https://build.ci.opensearch.org/job/integ-test/${req.params.x64_num}/flowGraphTable/`;
        let arm64_url = `https://build.ci.opensearch.org/job/integ-test/${req.params.arm64_num}/flowGraphTable/`;

        let x64_objs = await utility.html_parse(x64_url, req.params.x64_num, 'x64', req);
  
        let arm64_objs = await utility.html_parse(arm64_url, req.params.arm64_num, 'arm64', req);

        let compObjs = [];
        let ind = 0;
        
        for(let i = 0; i < Math.min(x64_objs.length, arm64_objs.length); i++){
            compObjs.push(x64_objs[i]);
            compObjs.push(arm64_objs[i]);
            ind++;
        }
        if(x64_objs.length > arm64_objs.length){
            for(let i = ind; i < x64_objs.length; i++){
                compObjs.push(x64_objs[i]);
            }
        }
        else{
            for(let i = ind; i < arm64_objs.length; i++){
                compObjs.push(arm64_objs[i]);
            }
        }
        res.render('integ', {compObjs: compObjs});
    }
    else if(req.params.dashboard === 'd'){
        let x64_url_with = `https://ci.opensearch.org/ci/dbc/integ-test-opensearch-dashboards/${req.params.version}/${req.params.build_number}/linux/x64/tar/test-results/${req.params.x64_num}/integ-test/functionalTestDashboards/with-security/test-results/stdout.txt`;
        let x64_url_without = `https://ci.opensearch.org/ci/dbc/integ-test-opensearch-dashboards/${req.params.version}/${req.params.build_number}/linux/x64/tar/test-results/${req.params.x64_num}/integ-test/functionalTestDashboards/without-security/test-results/stdout.txt`;
        let arm64_url_with = `https://ci.opensearch.org/ci/dbc/integ-test-opensearch-dashboards/${req.params.version}/${req.params.build_number}/linux/arm64/tar/test-results/${req.params.arm64_num}/integ-test/functionalTestDashboards/with-security/test-results/stdout.txt`;
        let arm64_url_without = `https://ci.opensearch.org/ci/dbc/integ-test-opensearch-dashboards/${req.params.version}/${req.params.build_number}/linux/arm64/tar/test-results/${req.params.arm64_num}/integ-test/functionalTestDashboards/without-security/test-results/stdout.txt`;
        
        
        let x64_with_objs = await utility.dashboard_parse(x64_url_with, 'x64');
        let x64_without_objs = await utility.dashboard_parse(x64_url_without,'x64');
        let arm64_with_objs = await utility.dashboard_parse(arm64_url_with, 'arm64');
        let arm64_without_objs = await utility.dashboard_parse(arm64_url_without,'arm64');

        let compObjs = [];

        for(let i = 0; i < Math.max(x64_with_objs.length, x64_without_objs.length, arm64_with_objs.length, arm64_without_objs.length); i++){
            if(i < x64_with_objs.length){
                x64_with_objs[i].log = x64_url_with;
                x64_with_objs[i].security = 'With security';
                compObjs.push(x64_with_objs[i]);
            }
            if(i < x64_without_objs.length){
                x64_without_objs[i].log = x64_url_without;
                x64_without_objs[i].security = 'Without security';
                compObjs.push(x64_without_objs[i]);
            }
            if(i < arm64_with_objs.length){
                arm64_with_objs[i].log = arm64_url_with;
                arm64_with_objs[i].security = 'With security';
                compObjs.push(arm64_with_objs[i]);
            }
            if(i < arm64_without_objs.length){
                arm64_without_objs[i].log = arm64_url_without;
                arm64_without_objs[i].security = 'Without security';
                compObjs.push(arm64_without_objs[i]);
            }
        }
        res.render('integ_dashboards', {compObjs: compObjs});
    }
    
})

app.get('/perf', function(req, res){
    perf_utils.perf_fetch(res);
})

app.listen(port, function(){
    console.log(`Example app listening on ${port}!`);
});

