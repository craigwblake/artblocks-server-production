const express = require('express');
const Web3 = require('web3');
const app = express();
const fs = require('fs');
var favicon = require('serve-favicon')
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');
// https://oneclickdapp.com/spark-siren/


const PORT = process.env.PORT || 8080;
const API_KEY = process.env.INFURA_KEY;

var web3 = new Web3(`https://rinkeby.infura.io/v3/${API_KEY}`);
const {abi} = require('./artifacts/GenArt721.json');
const address = "0x6917fFeAD6e58D3FE912f0d542e8dc88A9E3a5df";
const contract = new web3.eth.Contract(abi, address);
console.log(address);

app.set('views', './views');
app.set('view engine', 'pug');
app.use(express.static(__dirname+'./'));
app.use(express.static('src'));


app.use(cors());
app.use(favicon(__dirname+'/favicon.ico'));
let pathToHtml = path.join(__dirname, 'index.html');

app.get("/project/:projectId", async (request, response) =>{
  if (!Number.isInteger(Number(request.params.projectId))){
    console.log("not integer");
    response.send('invalid request');
  } else {
  const nextProjectId = await contract.methods.nextProjectId().call();
  const exists = request.params.projectId<nextProjectId;
  if (exists){
    const projectDetails = await getDetails(request.params.projectId);
	  let script = await getScript(request.params.projectId,projectDetails.projectScriptInfo.scriptCount);
    response.render('projectInfo', {
		     name:projectDetails.projectDescription.projectName,
		     artist: projectDetails.projectDescription.artistName,
         description: projectDetails.projectDescription.description,
         website: projectDetails.projectDescription.artistWebsite,
         license: projectDetails.projectDescription.license,
	       scriptJSON: JSON.stringify(projectDetails.projectScriptInfo.scriptJSON),
         scriptType: projectDetails.projectScriptInfo.scriptJSON.type,
         scriptVersion: projectDetails.projectScriptInfo.scriptJSON.version,
         scriptRatio: projectDetails.projectScriptInfo.scriptJSON.aspectRatio,
         instructions: projectDetails.projectScriptInfo.scriptJSON.instructions,
		     script: script,
		     hashesGen: projectDetails.projectScriptInfo.hashesPerToken,
		     isDynamic: projectDetails.projectDescription.dynamic,
         artistAddress: projectDetails.projectTokenInfo.artistAddress,
         additionalPayee: projectDetails.projectTokenInfo.additionalPayee,
         additionalPayeePercentage: projectDetails.projectTokenInfo.additionalPayeePercentage,
         price: web3.utils.fromWei(projectDetails.projectTokenInfo.pricePerTokenInWei, 'ether'),
	       invocations: projectDetails.projectTokenInfo.invocations,
         tokensOfProject: projectDetails.projectTokenInfo.tokens,
		     maxInvocations: projectDetails.projectTokenInfo.maxInvocations,
         active: projectDetails.projectTokenInfo.active,
         paused: projectDetails.projectScriptInfo.paused
	  })
  } else {
    response.send('project does not exist');
  }
 }
});

app.get("/", async (request, response) =>{
  response.render('home');
})

app.get("/platform", async (request, response) =>{
  const platformInfo = await getPlatformInfo();
  let projects=[];
  for (let i=0;i<platformInfo.nextProjectId;i++){
    projects.push(i);
  }

  response.render('platformInfo', {
		name:platformInfo.name,
		symbol:platformInfo.symbol,
    address:address,
		totalSupply: platformInfo.totalSupply,
		projects: projects,
		nextProjectId:platformInfo.nextProjectId
	})
})

app.get('/token/:tokenId', async(request,response)=>{
  if (!Number.isInteger(Number(request.params.tokenId))){
    console.log("not integer");
    response.send('invalid request');
  } else {
    const projectId = await getProjectId(request.params.tokenId);
    const tokensOfProject = await contract.methods.projectShowAllTokens(projectId).call();
    const exists = tokensOfProject.includes(request.params.tokenId);
    console.log("exists? "+exists);
    console.log('image request '+request.params.tokenId);

    if (exists){
      let tokenDetails = await getToken(request.params.tokenId);
	     let projectDetails = await getDetails(tokenDetails.projectId);
       let tokenHashes = await getTokenHashes(request.params.tokenId);
       let royalties = await getTokenRoyaltyInfo(request.params.tokenId);


       response.json(
         {
           "platform":"Art Blocks",
           "name":projectDetails.projectDescription.projectName + " #"+(request.params.tokenId-tokenDetails.projectId*1000000),
           "description":projectDetails.projectDescription.description,
           "external_url": projectDetails.projectURIInfo.projectBaseURI.slice(0,-6)+"generator/"+request.params.tokenId,
           "artist":projectDetails.projectDescription.artistName,
           "royaltyInfo":{
             "artistAddress":royalties.artistAddress,
             "additionalPayee":royalties.additionalPayee,
             "additionalPayeePercentage":royalties.additionalPayeePercentage,
             "royaltyFeeByID":royalties.royaltyFeeByID
           },
           "traits":[
             {"trait_type":"Project",
             "value":projectDetails.projectDescription.projectName+ " by "+projectDetails.projectDescription.artistName}
           ],

           "website":projectDetails.projectDescription.artistWebsite,
           "is dynamic":projectDetails.projectDescription.dynamic,
           "script type":projectDetails.projectScriptInfo.scriptJSON.type,
           "aspect ratio (w/h)":projectDetails.projectScriptInfo.scriptJSON.aspectRatio,
           "hashes per token":projectDetails.projectScriptInfo.hashesPerToken,
           "tokenID":request.params.tokenId,
           "token hash(es)":tokenHashes,
           "license":projectDetails.projectDescription.license,
           "image":projectDetails.projectURIInfo.projectBaseURI.slice(0,-6)+"image/"+request.params.tokenId
         });
    } else {
      response.send('token does not exist');
    }
  }
});

app.get('/generator/:tokenId', async (request, response) => {
  if (!Number.isInteger(Number(request.params.tokenId))){
    console.log("not integer");
    response.send('invalid request');
  } else {
    const projectId = await getProjectId(request.params.tokenId);
    const tokensOfProject = await contract.methods.projectShowAllTokens(projectId).call();
    const exists = tokensOfProject.includes(request.params.tokenId);
    console.log("exists? "+exists);
    //console.log('image request '+request.params.tokenId);

    if (exists){
	    let tokenDetails = await getToken(request.params.tokenId);
	    let projectDetails = await getDetails(tokenDetails.projectId);
	    let script = await getScript(tokenDetails.projectId,projectDetails.projectScriptInfo.scriptCount);
	    let data = buildData(tokenDetails.hashes, request.params.tokenId, projectDetails.projectScriptInfo.scriptJSON);

      if (projectDetails.projectScriptInfo.scriptJSON.type==='p5js'){
        response.render('generator_p5js', { script: script, data: data})
      } else if (projectDetails.projectScriptInfo.scriptJSON.type==='processing'){
        response.render('generator_processing', { script: script, data: data})
      } else if (projectDetails.projectScriptInfo.scriptJSON.type==='a-frame'){
        response.render('generator_aframe', { script: script, data: data})
      } else if (projectDetails.projectScriptInfo.scriptJSON.type==='megavox'){
        response.render('generator_megavox', { script: script, data: data})
      } else if (projectDetails.projectScriptInfo.scriptJSON.type==='vox'){
        response.render('generator_vox', { script: script, data: data})
      } else {
       response.render('generator_threejs', { script: script, data: data})
     }
   } else {
       response.send('token does not exist');
     }
  }
});

app.get("/vox/:tokenId", async (request, response)=>{
  if (!Number.isInteger(Number(request.params.tokenId))){
    console.log("not integer");
    response.send('invalid request');
  } else {
    const projectId = await getProjectId(request.params.tokenId);
    const tokensOfProject = await contract.methods.projectShowAllTokens(projectId).call();
    const exists = tokensOfProject.includes(request.params.tokenId);
    console.log("exists? "+exists);
    console.log('image request '+request.params.tokenId);

    if (exists){
      let tokenDetails = await getToken(request.params.tokenId);
	    let projectDetails = await getDetails(tokenDetails.projectId);
      if (projectDetails.projectScriptInfo.scriptJSON.type==='vox' || projectDetails.projectScriptInfo.scriptJSON.type==='megavox'){
	       let script = await getScript(tokenDetails.projectId,projectDetails.projectScriptInfo.scriptCount);
         let data = buildData(tokenDetails.hashes, request.params.tokenId, projectDetails.projectScript.scriptJSON.type);
         let scriptAndData = `${data}${script}`;
         var evalScript = eval(scriptAndData);
         let array = voxx.export();
         response.send(toBuffer(array));
       } else {
         response.send('token not a vox file');
       }
     } else {
        response.send('token does not exist');
    }
  }
})

app.get("/image/:tokenId/:refresh?", async (request, response) => {
  //check if token exists
  if (!Number.isInteger(Number(request.params.tokenId))){
    console.log("not integer");
    response.send('invalid request');
  } else {
    const file = path.resolve(__dirname, "./images/"+request.params.tokenId+".png");
    if (fs.existsSync(file) && !request.params.refresh) {
      console.log('serving local');
      response.sendFile(file);
    } else {
      const projectId = await getProjectId(request.params.tokenId);
      const tokensOfProject = await contract.methods.projectShowAllTokens(projectId).call();
      const exists = tokensOfProject.includes(request.params.tokenId);
      const scriptInfo = await contract.methods.projectScriptInfo(projectId).call();
      const scriptJSON = JSON.parse(scriptInfo[0]);
      const ratio = scriptJSON.aspectRatio;
      console.log("exists? "+exists);
      console.log('image request '+request.params.tokenId);


      if (exists){
	       serveScriptResult(request.params.tokenId, ratio).then(result=>{
         console.log("Running Puppeteer");
				 response.set('Content-Type', 'image/png');
				 response.send(result);
			 });
    } else {
      response.send('token does not exist');
    }
  }
 }
});


async function serveScriptResult(tokenId, ratio){
  const width = Math.floor(ratio<=1?800*ratio:800);
  const height = Math.floor(ratio<=1?800:800/ratio);
  const path = './images/'+tokenId+'.png';
  try {

    const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
    const page = await browser.newPage();
    await page.setViewport({
      width: width,
      height: height,
      deviceScaleFactor: 2,
    });
    await page.goto('http://localhost:8080/generator/'+tokenId);
    //await page.goto('https://rinkebyapi.artblocks.io/generator/'+tokenId);
    //await timeout(1000);
    const image = await page.screenshot();
    await browser.close();
    fs.writeFile("./images/"+ tokenId+ ".png", image, function(err) {

    });
    return image;
  } catch (error) {
    console.log(tokenId+ '| this is the error: '+error);

  }
}


function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

async function getToken(tokenId){
  const projectId = await getProjectId(tokenId);
  const hashes = await getTokenHashes(tokenId);
  return {tokenId, projectId, hashes};
}

async function getDetails(projectId){
  const projectDescription = await getProjectDescription(projectId);
  const projectScriptInfo = await getScriptInfo(projectId);
  const projectTokenInfo = await getTokenDetails(projectId);
  const projectURIInfo = await getURIInfo(projectId);
  return {projectDescription, projectScriptInfo, projectTokenInfo, projectURIInfo};
}

async function getScript(projectId, scriptCount){
	let scripts = [];
	for (let i=0;i<scriptCount;i++){
		let newScript = await contract.methods.projectScriptByIndex(projectId,i).call();
		scripts.push(newScript);
	}
	return scripts.join(' ');
}

async function getScriptInfo(projectId){
  const result = await contract.methods.projectScriptInfo(projectId).call();
  return {scriptJSON:JSON.parse(result[0]), scriptCount:result[1], hashesPerToken:result[2], ipfsHash:result[3], locked:result[4], paused:result[5]};
}

async function getProjectDescription(projectId){
  const result = await contract.methods.projectDetails(projectId).call();
  return {projectName:result[0], artistName:result[1], description: result[2], artistWebsite:result[3], license:result[4], dynamic:result[5]};
}

async function getURIInfo(projectId){
  const result = await contract.methods.projectURIInfo(projectId).call();
  return {projectBaseURI:result[0], projectBaseIpfsURI:result[1], useIpfs: result[2]};
}

async function getTokenDetails(projectId){
	const tokens = await contract.methods.projectShowAllTokens(projectId).call();
  const result = await contract.methods.projectTokenInfo(projectId).call();
  return {artistAddress:result[0], pricePerTokenInWei:result[1], invocations:result[2], maxInvocations:result[3], active:result[4], additionalPayee:result[5], additionalPayeePercentage:result[6],tokens:tokens};
}

async function getTokenRoyaltyInfo(tokenId){
	const result = await contract.methods.getRoyaltyData(tokenId).call();
  return {artistAddress:result[0], additionalPayee:result[1], additionalPayeePercentage:result[2], royaltyFeeByID:result[3]};
}

async function getTokenHashes(tokenId){
  const result = await contract.methods.showTokenHashes(tokenId).call();
  return result;
}

async function getPlatformInfo(){
  const totalSupply = await contract.methods.totalSupply().call();
	//const projectIds = await contract.methods.showAllProjectIds().call(); //cap S
	const nextProjectId = await contract.methods.nextProjectId().call(); //change platofrm_
	const name = await contract.methods.name().call();
	const symbol = await contract.methods.symbol().call();

  return {totalSupply, nextProjectId, name, symbol};
}

async function getProjectId(tokenId){
  const result = await contract.methods.tokenIdToProjectId(tokenId).call();
  return result;
}

function buildData(hashes, tokenId, type){
  //to expose token hashes use let hashes = tokenData.hashes[0] (example if only one hash is minted)
	let data = {};
	data.hashes = hashes;
	data.tokenId = tokenId;
  if (type === "processing"){
    console.log(hashes[0]);
    return `let tokenData = "${hashes[0]}"`;
  }
	return `let tokenData = ${JSON.stringify(data)}`;
}
  function toBuffer(ab) {
    var buf = Buffer.alloc(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buf.length; ++i) {
      buf[i] = view[i];
    }
    return buf;
  }

app.listen(PORT, () => console.log(`Art Blocks listening at http://localhost:${PORT}`))
