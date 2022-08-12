const fetch = require('node-fetch');
const express = require('express');
const http = require('http');
const https = require('https');
const yaml = require('js-yaml');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;
const NUM_OF_BUILDS = 30;
const build_num_set = {};



let manifest_url = 'https://ci.opensearch.org/ci/dbc/distribution-build-opensearch/2.2.0/5821/linux/x64/tar/builds/opensearch/manifest.yml';

// version in the format of: x.x.x
// build number in the format of: xxxx
function change_manifest_url(build_num, version){
    manifest_url = 'https://ci.opensearch.org/ci/dbc/distribution-build-opensearch/' + version + '/' + build_num + '/linux/x64/tar/builds/opensearch/manifest.yml';
}

function create_artifact_url(build_num, version, architecture, type){
    return 'https://ci.opensearch.org/ci/dbc/distribution-build-opensearch/' + version + '/' + build_num + '/linux/' + architecture + '/' + type
    + '/dist/opensearch/opensearch-' + version + '-linux-' + architecture + '.' + type + (type === 'tar' ? '.gz' : '');
}

function create_yml_url(build_num){
    return 'https://build.ci.opensearch.org/job/distribution-build-opensearch/' + build_num + '/artifact/commits.yml';
}


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

function check_delete(build_nums){
    fs.readdir('build_ymls', (err, files) => {
        files.forEach(file => {
            console.log(file, ' exists');
            if(!(file in build_num_set)){
                fs.rmSync(`build_ymls/${file}`, { recursive: true, force: true });
                console.log(file, ' deleted');

            }
        });
    });
    // for(let i = 0; i < NUM_OF_BUILDS; i++){
        
    // }
    
}
function download_manifest(manifest_url, old_res){
    https.get(manifest_url,(res) => {
        const path = `${__dirname}/files/manifest_test.yml`; 
        const filePath = fs.createWriteStream(path, {flags: 'w+'});
        res.pipe(filePath);
        filePath.on('finish',() => {
            filePath.close();
            console.log('Download Completed');
            try {
                const manifest_json = yaml.load(fs.readFileSync('files/manifest_test.yml', 'utf8'));
                //console.log(manifest_json);
                old_res.render('new', {manifest_json: manifest_json});
              } catch (e) {
                console.log(e);
            }
        })
    })
}

function download_yml(yml_url, build_num){
    https.get(yml_url,(res) => {
        const path = `${__dirname}/build_ymls/${build_num}/commits.yml`; 
        const filePath = fs.createWriteStream(path, {flags: 'w+'});
        res.pipe(filePath);
        filePath.on('finish',() => {
            filePath.close();
            console.log('yml Download Completed');
            if(res.statusCode === 404){
                // fs.rmSync(`build_ymls/${build_num}`, { recursive: true, force: true });
                // console.log(build_num, ' deleted');
                fs.mkdir('build_ymls/' + build_num + '/ABORTED', (err)=>{
                    if(err){
                        console.log(err);
                    }
                    else{
                        console.log(`Directory ${build_num}/ABORTED created`);
                    }
                });
            }
        })
        

        // if(err){
        //     console.log(`${build_num} yml download failed`);
        // }
    })
}
function yml_exists(build_num){
    return fs.existsSync('build_ymls/' + build_num.toString());
    
}
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

function yaml_to_json(){
    try {
        const manifest_json = yaml.load(fs.readFileSync('files/manifest_test.yml', 'utf8'));
        console.log(manifest_json);
      } catch (e) {
        console.log(e);
    }
}


let build_nums = []

let fetchh = async (res) => {

    let builds_url = 'https://build.ci.opensearch.org/job/distribution-build-opensearch';
    //let jobs = await fetch('https://build.ci.opensearch.org/job/distribution-build-opensearch/api/json?tree=allBuilds[number,url]');
    let jobs = await fetch(builds_url + '/api/json');

    let jobs_json = await jobs.json();
    build_nums = []
    for(let i = 0; i < NUM_OF_BUILDS; i++){
        build_nums.push({build_num: jobs_json.builds[i].number});
        build_num_set[jobs_json.builds[i].number.toString()] = null;
    }
    console.log(build_nums);
    // jobs_json.builds.forEach(build => {
    //     build_nums.push({build_num: build.number});
    //     
    //     build_num_set[build.number.toString()] = null;
    // });
    // jobs_json.allBuilds.forEach(build => build_nums.push(build.number));


    for(let i = 0; i < NUM_OF_BUILDS; i++){
        if(yml_exists(build_nums[i].build_num)){
            build_nums[i].running = 'Done';
            if(fs.existsSync(`build_ymls/${build_nums[i].build_num}/ABORTED`)){
                build_nums[i].result = 'ABORTED';
            } else {
                try {
                    const yml_json = yaml.load(fs.readFileSync(`build_ymls/${build_nums[i].build_num}/commits.yml`, 'utf8'));
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
                fs.mkdir('build_ymls/' + build_nums[i].build_num.toString(), (err)=>{
                    if(err){
                        console.log(err);
                    }
                    else{
                        console.log(`Directory ${build_nums[i].build_num} created`);
                        download_yml(create_yml_url(build_nums[i].build_num), build_nums[i].build_num);
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
            build_nums[i].duration = convert_build_duration(build_json.duration);
            
        }
        build_nums[i].x64_tar = create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'x64', 'tar');
        build_nums[i].arm64_tar = create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'arm64', 'tar');
        build_nums[i].x64_rpm = create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'x64', 'rpm');
        build_nums[i].arm64_rpm = create_artifact_url(build_nums[i].build_num, build_nums[i].version, 'arm64', 'rpm');
    }
    //console.log(build_nums);
    check_delete(build_nums);
    res.render('index', {builds_array: build_nums, NUM_OF_BUILDS: NUM_OF_BUILDS}); 
}

app.use(express.static(__dirname + '/public'));

app.set('view engine', 'ejs');  

app.get('/', function(req, res){
    fetchh(res);
});

app.get('/commits/:build_number', function(req, res){
    // change_manifest_url(req.params.build_number, req.params.version);
    // download_manifest(manifest_url, res);
    const yml_json = yaml.load(fs.readFileSync(`build_ymls/${req.params.build_number}/commits.yml`, 'utf8'));
    res.render('commits', {yml_json: yml_json});
    
})

app.get('/CVE/:build_number', function(req, res){
    // change_manifest_url(req.params.build_number, req.params.version);
    // download_manifest(manifest_url, res);
    const yml_json = yaml.load(fs.readFileSync(`build_ymls/${req.params.build_number}/commits.yml`, 'utf8'));
    res.render('CVE', {yml_json: yml_json, change_formatting: change_formatting});
    
})


async function dl_perf(res){
    let builds_url = 'https://ci.opensearch.org/ci/dbc/perf-test/1.2.4/762/linux/x64/test-results/perf-test/without-security/2caaa49a-3af7-438e-a090-7cf39f59a599.json';
    let jobs = await fetch(builds_url);

    let jobs_json = await jobs.json();

    console.log(jobs_json);

    res.render('Perf', {json: jobs_json});
    
}
app.get('/Perf', function(req, res){
    // change_manifest_url(req.params.build_number, req.params.version);
    // download_manifest(manifest_url, res);
    //const yml_json = yaml.load(fs.readFileSync(`test_yml/test.yml`, 'utf8'));

    dl_perf(res)
    
    
})


app.listen(port, function(){
    console.log(`Example app listening on ${port}!`);
    // const file = 'files';
    // fs.access(file, fs.constants.F_OK, (err) => {
    //     console.log(`${file} ${err ? 'does not exist' : 'exists'}`);
    // });
    // download_manifest(manifest_url);
    // yaml_to_json();

});

