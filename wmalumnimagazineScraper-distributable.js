/*
*
* W&M Alumni Magazine Wordpress website => Cascade importer
* by Sean Flynn - William & Mary
* sflynn@wm.edu / sean.flynn@gmail.com
* v1.1 - Oct. 18, 2018: Initial release & import run
* Final import run: Oct. 21, 2018
*
* Notes:
*    Requires CasperJS (http://casperjs.org/); this was written against v. 1.1.4 for Mac.
*    Install CasperJS with Homebrew (https://brew.sh/); script is ready to run.
*
*/


// inject jQuery!
var casper = require('casper').create({
    clientScripts: ["jquery.min.js"]
});

var utils = require('utils');
var fs = require('fs');

var issues = [];
var stories = [];
var arrArticleURLs = [];
var baseURL = "https://wmalumnimagazine.com";

// Set your API user/pass here.
var user = '***';
var pass = '***';
var apiURL = 'https://cascade.wm.edu/api/v1/read/file/Advancement/magazine.wm.edu/'


casper.on('remote.message', function(message) {
    this.echo('remote message caught: ' + message);
});

// collect issues.
function getIssues() {
    issues = document.querySelectorAll('.cover-image > a');
	// make the NodeList an array so we can do array things with it.
	arrIssues = [].slice.call(issues);
	// we know we only want the first 16 magazines.
	arrIssues = arrIssues.slice(0,16);

    return Array.prototype.map.call(arrIssues, function(e) {
        return e.getAttribute('href');
    });
}

// gets the articles out of each magazine page
function getArticles(){
	articles = document.querySelectorAll('li.article-title > a');
    return Array.prototype.map.call(articles, function(e) {
        return e.getAttribute('href');
    });	
}

casper.start('http://wmalumnimagazine.com/archives/', function() {
	// let's have some issues
	issues = this.evaluate(getIssues);	
});


casper.then(function(){
	// get issues from index page
	this.each(issues, function(self, issue){
		this.thenOpen(issue, function(){
			// this is just debug code
			this.echo(this.getTitle()); 
			this.echo(this.getCurrentUrl());
		});
			
		this.then(function(){
			// get the articles in the index page
			arrArticleURLs = this.evaluate(getArticles);
			this.each(arrArticleURLs, function(self, curStoryURL){
				this.thenOpen(curStoryURL, function(){
					// init per-story variables
					var year = '';
					var season = '';
					
					// per story
					utils.dump(curStoryURL);
					
					// let's get the things
					var curStoryStruct = this.evaluate(function(){
						// Load jQuery. every time. *sigh*
						var script = document.createElement("SCRIPT");
						script.src = 'https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js';
						script.type = 'text/javascript';
						script.onload = function() {
							var $ = window.jQuery;
						};

						document.getElementsByTagName("head")[0].appendChild(script);

						curStoryStruct = {
							"author": "",
							"body": "",
							"category": "",
							"headline": "",
							"subhed": "",
							"filename": "",
							"images": [],
							"pubDate": "",
							"jsDate": ""
						};

						var nlimgs = $('article > .entry-content').find('img');
						
						for(i=0; i < nlimgs.length; i++){
							$( nlimgs[i] ).removeAttr('srcset');
							$( nlimgs[i] ).removeAttr('sizes');
							$( nlimgs[i] ).attr('src', $( nlimgs[i] ).attr('src').toLowerCase());
							if (i!=0){
								curStoryStruct.images.push(nlimgs[i].src.toLowerCase());
							}
							else {
								nlimgs[i].remove();
							}
						}

						// lowercase some links
						var links = $('article > .entry-content').find('a');
						for(i=0; i < links.length; i++){
							var attr = $( links[i] ).attr('href');
							if (typeof attr !== typeof undefined && attr !== false){
								$( links[i] ).attr('href', $( links[i] ).attr('href').toLowerCase());
							}
						}

						if (document.querySelector('.entry-author') !== null){
							curStoryStruct.author = document.querySelector('.entry-author').innerText;
							curStoryStruct.author = curStoryStruct.author.replace(/by\s*/gi, '')
						}

						curStoryStruct.headline = document.querySelector('.entry-title').innerText;
						if (document.querySelector('.entry-subtitle') !== null){
							curStoryStruct.subhed = document.querySelector('.entry-subtitle').innerText;
						}

						curStoryStruct.body = document.querySelector('article > .entry-content').innerHTML;
						return(curStoryStruct);
					});
					
					/* END EVALUATE */
					
					// replace blank authors with staff
					if (curStoryStruct.author == ""){
						curStoryStruct.author = "Advancement Staff";
					}

					// parse the url out: /year/season/category/filename/
					
					yrsnregexp = curStoryURL.match(/\/(20[0-9]{2})\/([^\/]*?)\/([^\/]*?)\/([^\/]*)\/$/);
					
					if (yrsnregexp.length > 4){
						curStoryStruct.year = yrsnregexp[1];
						curStoryStruct.season = yrsnregexp[2].toLowerCase();
						curStoryStruct.category = yrsnregexp[3].toLowerCase();
						curStoryStruct.filename = yrsnregexp[4].toLowerCase();
					}
					else{
						this.die('failed to get year/season');
					}
					
					// next we need to do story cleanup stuff.
					// first, let's download the images
					// uncomment to do this

//					for(var i=0; i < curStoryStruct.images.length; i++){
//						var filenameregexp = curStoryStruct.images[i].match(/\/([^\/]*)$/);
//						var filename = filenameregexp[1];
//						// uncomment this if you need to redownload the images
////						this.download(curStoryStruct.images[i], 'images/' + curStoryStruct.year + '/' + curStoryStruct.season + '/' + filename);
//					}
					
					// replace old image paths with new image paths
					var newImgPath = 'https://magazine.wm.edu/img/issues/' + curStoryStruct.year + '/' + curStoryStruct.season + '/';
					var re = /(http:\/\/wmalumnimagazine\.com\/wp-content\/uploads\/[0-9]{4}\/[0-9]+\/)/gi;

					curStoryStruct.body = curStoryStruct.body.replace(re, newImgPath);

					// time to clean the body

					// remove everything in comments
					curStoryStruct.body = curStoryStruct.body.replace(/<!--[\s\S]*-->/gi, '');
					curStoryStruct.body = curStoryStruct.body.replace(/<rdf[^>]*>\s*/gi, '');

					// clean the summary
					curStoryStruct.subhed = curStoryStruct.subhed.replace(/[\u2018\u2019]/g, "'");
					curStoryStruct.subhed = curStoryStruct.subhed.replace(/[\u201C\u201D]/g, '"');
					curStoryStruct.subhed = curStoryStruct.subhed.replace(/&nbsp;/gi, ' ');
					curStoryStruct.subhed = curStoryStruct.subhed.replace(/&amp;/gi, '&');
					curStoryStruct.subhed = curStoryStruct.subhed.replace(/&mdash;/gi, '—');
					curStoryStruct.subhed = curStoryStruct.subhed.replace(/&ndash;/gi, '-');
					curStoryStruct.subhed = curStoryStruct.subhed.replace(/\s{2,}/gi, ' ');

					// clean the summary
					curStoryStruct.headline = curStoryStruct.headline.replace(/[\u2018\u2019]/g, "'");
					curStoryStruct.headline = curStoryStruct.headline.replace(/[\u201C\u201D]/g, '"');
					curStoryStruct.headline = curStoryStruct.headline.replace(/&nbsp;/gi, ' ');
					curStoryStruct.headline = curStoryStruct.headline.replace(/&amp;/gi, '&');
					curStoryStruct.headline = curStoryStruct.headline.replace(/&mdash;/gi, '—');
					curStoryStruct.headline = curStoryStruct.headline.replace(/&ndash;/gi, '-');
					curStoryStruct.headline = curStoryStruct.headline.replace(/\s{2,}/gi, ' ');

					// clean the body
					curStoryStruct.body = curStoryStruct.body.replace(/[\u00A0-\u9999]/gim, function(i) 
																		{  return '&#'+i.charCodeAt(0)+';'; });
					curStoryStruct.body = curStoryStruct.body.replace(/&nbsp;/gi, ' ');
					curStoryStruct.body = curStoryStruct.body.replace(/<\/?div[^>]*>/gi, '<br />');
					curStoryStruct.body = curStoryStruct.body.replace(/<\/?span[^>]*>/gi, ' ');
					curStoryStruct.body = curStoryStruct.body.replace(/&nbsp;/gi, ' ');

					// continually remove BRs from the start of the article
					// we could do this smarter, but
					// if it's stupid and it works
					curStoryStruct.body = curStoryStruct.body.replace(/^\s*<br\s*\/>\s*/gi, '');	
					curStoryStruct.body = curStoryStruct.body.replace(/^\s*<br\s*\/>\s*/gi, '');
					curStoryStruct.body = curStoryStruct.body.replace(/^\s*<br\s*\/>\s*/gi, '');
					curStoryStruct.body = curStoryStruct.body.replace(/^\s*<br\s*\/>\s*/gi, '');
					curStoryStruct.body = curStoryStruct.body.replace(/^\s*<br\s*\/>\s*/gi, '');

					// change lots of BRs to one BR
					curStoryStruct.body = curStoryStruct.body.replace(/(<br\s*\/>\s*){2,}/gi, '<br />');
					// remove excess spaces
					curStoryStruct.body = curStoryStruct.body.replace(/class\s*=\s*"[^"]*"/gi, '');

					curStoryStruct.headline = curStoryStruct.headline.replace(/\&amp;/gi, '&');
					curStoryStruct.headline = curStoryStruct.headline.replace(/\%20/gi, ' ');
					curStoryStruct.headline = curStoryStruct.headline.replace(/[\u2018\u2019]/g, "'");
					curStoryStruct.headline = curStoryStruct.headline.replace(/[\u201C\u201D]/g, '"');

					curStoryStruct.author = curStoryStruct.author.replace(/[\u00A0-\u9999]/gim, function(i) 
																	{  return '&#'+i.charCodeAt(0)+';'; });
					
					/* MAKE SOME DATE */
					// this makes a date in format 
					// Feb 28, 2018 2:00:00 AM
					
					var monthStruct = {
						'winter': 'Jan',
						'spring': 'Apr',
						'summer': 'Jul',
						'fall': 'Oct'
					};

					var pubDate = monthStruct[curStoryStruct.season] + ' 01, ' + curStoryStruct.year + ' 12:01:01 AM';
					
					if (pubDate !== null){
						curStoryStruct.pubDate = pubDate;
					}
					else {
						// if we can't get a pubdate we need SOMETHING.
						curStoryStruct.pubDate = "Jan 01, 1970 12:00:01 AM" // epoch fail
					}
					
					curStoryStruct.jsDate = new Date(pubDate).valueOf(); // this is stupid but i'm exhausted
					
					// OKAY, now let's get the featured image, get its assetID and
					// add them to the struct. 
					
					if(curStoryStruct.images.length > 0){
						var featuredImageURL = curStoryStruct.images[0];
						var featuredImageFilename = featuredImageURL.match(/\/([^\/]*)$/)[1];
						
						if (featuredImageFilename != null && featuredImageFilename != '') {
							curStoryStruct.featuredImageFilename = featuredImageFilename;
							url = apiURL + 'img/issues/' + curStoryStruct.year + '/' + curStoryStruct.season + '/' + featuredImageFilename + '?u=' + user + '&p=' + pass;

							// this.open adds to the event stack just like casper.then
							this.open(url, {
								method: 'get',
								headers: {
									'Accept': 'application/json'
								}
							});

							this.then(function (){
								if (this.getPageContent() != null && this.getPageContent() != ''){
									// is there anything here?
									var ret = JSON.parse(this.getPageContent());
									
									if (ret != null && ret != 'undefined' && ret != ''){
										curStoryStruct.thumbnailAssetID = ret.asset.file.id; 
										this.echo('got the id!');
										utils.dump(ret.asset.file.id);
									}
									else{
										utils.dump(ret);
										utils.dump(featuredImageFilename);
										this.exit();
									}
								}
							});
						}
					}
					else{
						utils.dump("there doesn't seem to be a featured image");
					}
					
					/* get the associated issue ID */

					// this.then should work here. I don't recall why it's
					// casper.then and frankly I was on deadline and didn't want to fiddle.
					// feel free though.
				
					
					// send API read request
					casper.then(function(){
						var apiPageURL = 'https://cascade.wm.edu/api/v1/read/page/Advancement/magazine.wm.edu/';
						url = apiPageURL + 'issue/' + curStoryStruct.year + '-' + curStoryStruct.season + '/index' + '?u=' + user + '&p=' + pass;

						this.open(url, {
							method: 'get',
							headers: {
								'Accept': 'application/json'
							}
						});
					});

					// process API read request response
					casper.then(function (){
						if (this.getPageContent() != null && this.getPageContent() != ''){
							// is there anything here?
							var ret = JSON.parse(this.getPageContent());

							if (ret != null && ret != 'undefined' && ret != ''){
								curStoryStruct.associatedIssueID = ret.asset.page.id; 
								this.echo('got the index page id!')
								utils.dump(ret.asset.page.id)
							}
							else{
								utils.dump(ret);
								utils.dump(featuredImageFilename)
								this.exit();
							}
						}
					});


				casper.then(function() {
					// uncomment this to write a JSON file per article
					// fs.write(curStoryStruct.filename+'.json', JSON.stringify(curStoryStruct), 'w');
					// utils.dump(JSON.parse(this.getPageContent()));
					
					// there's definitely a smarter way to do this: make the array ONCE and then 
					// just remove the appropriate elements if you don't have a thumbnail.
					// you should do it that way instead.

					if (curStoryStruct.thumbnailAssetID != null && curStoryStruct.thumbnailAssetID != ''){
						//push with images
						utils.dump("Sending with images " + curStoryStruct.thumbnailAssetID);
						utils.dump(curStoryStruct);
						url = 'https://cascade.wm.edu/api/v1/create?u=' + user + '&p=' + pass;
						utils.dump(url);

						data = 
{
	'asset': {
		'page': {
			'contentTypeId': '670ff83b0a000f0645cbfc0fe7acecb6',
			'contentTypePath': 'magazine.wm.edu/Simple Story',
			'name': curStoryStruct.filename,
			'parentFolderPath': '/magazine.wm.edu/issue/' + curStoryStruct.year + '-' + curStoryStruct.season,
			'siteName': 'Advancement',
			'structuredData': {
				'structuredDataNodes':
				[{
					'type': 'group',
					'identifier': 'content',
					'structuredDataNodes': [
					{
						'type': 'text',
						'identifier': 'storySubhead',
						'text': curStoryStruct.subhed,
						'recycled': false
					},
					{
						'type': 'asset',
						'assetType': 'file',
						'identifier': 'featuredImage',
						'fileId': curStoryStruct.thumbnailAssetID,
						'filePath': 'magazine.wm.edu/img/issues/' + curStoryStruct.year + '/' + curStoryStruct.season + '/' + featuredImageFilename,
						'recycled': false
					},
					{
						'type': 'text',
						'identifier': 'storyDate',
						'text': curStoryStruct.jsDate,
						'recycled': false
					},
					{
						'type':'text',
						'identifier':'pageText',
						'text': curStoryStruct.body,
						'recycled': false
					},
					{
						"type": "text",
						"identifier": "fullWidth",
						"text": "No",
						"recycled": false
					}
				],
					'recycled': false
				},
				{
					type: 'group',
					identifier: 'attribution',
					structuredDataNodes:[
					{
						"type": "text",
						"identifier": "authorPrefix",
						"text": "By",
						"recycled": false
					},
					{
						"type": "text",
						"identifier": "authorSuffix",
						"text": curStoryStruct.author,
						"recycled": false
					}]
				},
				{
					'type': 'asset',
					'identifier': 'thumbnail',
					'fileId': curStoryStruct.thumbnailAssetID,
					'filePath': 'magazine.wm.edu/issues/img/' + curStoryStruct.year + '/' + curStoryStruct.season + '/' + curStoryStruct.featuredImageFilename,
					'assetType': 'file',
					'recycled': false
				},
				{
					"type": "asset",
					"identifier": "associatedIssue",
					"pageId": curStoryStruct.associatedIssueID,
					"pagePath": "magazine.wm.edu/issue/" + curStoryStruct.year + "-" + curStoryStruct.season + "/index",
					"assetType": "page",
					"recycled": false
				}]
			},
			'metadata': {
				'author':  curStoryStruct.byline,
				'teaser': curStoryStruct.subhed,
				'summary': curStoryStruct.summary,
				'title':  curStoryStruct.headline,
				'startDate': curStoryStruct.pubDate,
				'dynamicFields':[
					{
						'name': 'showSiblings',
						'fieldValues':[
							{
								'value': 'Yes'
							}
						]
					},
					{
						"name": "category",
						"fieldValues": [
						  {
							"value": curStoryStruct.category
						  }
						]
					}					
				]
			}
		}
	}
};

			            casper.open(url, {
			                method: 'post',
			                headers: {
			                   'Content-Type': 'application/json; charset=utf-8'
			                }, 
			                data: data
			                });


					} else {
						// push without images
					utils.dump("Sending without images!");
						data = 
{
	'asset': {
		'page': {
			'contentTypeId': '670ff83b0a000f0645cbfc0fe7acecb6',
			'contentTypePath': 'magazine.wm.edu/Simple Story',
			'name': curStoryStruct.filename,
			'parentFolderPath': '/magazine.wm.edu/issue/' + curStoryStruct.year + '-' + curStoryStruct.season,
			'siteName': 'Advancement',
			'structuredData': {
				'structuredDataNodes':
				[{
					'type': 'group',
					'identifier': 'content',
					'structuredDataNodes': [
					{
						'type': 'text',
						'identifier': 'storySubhead',
						'text': curStoryStruct.subhed,
						'recycled': false
					},
					{
						'type': 'text',
						'identifier': 'storyDate',
						'text': curStoryStruct.jsDate,
						'recycled': false
					},
					{
						'type':'text',
						'identifier':'pageText',
						'text': curStoryStruct.body,
						'recycled': false
					},
					{
						"type": "text",
						"identifier": "fullWidth",
						"text": "No",
						"recycled": false
					}
				],
					'recycled': false
				},
				{
					type: 'group',
					identifier: 'attribution',
					structuredDataNodes:[
					{
						"type": "text",
						"identifier": "authorPrefix",
						"text": "By",
						"recycled": false
					},
					{
						"type": "text",
						"identifier": "authorSuffix",
						"text": curStoryStruct.author,
						"recycled": false
					}]
				},
				{
					"type": "asset",
					"identifier": "associatedIssue",
					"pageId": curStoryStruct.associatedIssueID,
					"pagePath": "magazine.wm.edu/issue/" + curStoryStruct.year + "-" + curStoryStruct.season + "/index",
					"assetType": "page",
					"recycled": false
				}
				]
			},
			'metadata': {
			'author':  curStoryStruct.byline,
			'teaser': curStoryStruct.subhed,
			'summary': curStoryStruct.summary,
			'title':  curStoryStruct.headline,
			'startDate': curStoryStruct.pubDate,
			'dynamicFields':[
				{
					'name': 'showSiblings',
					'fieldValues':[
						{
						'value': 'Yes'
						}
					]
				},
				{
					"name": "category",
					"fieldValues": [
					  {
						"value": curStoryStruct.category
					  }
					]
				}
			]
			}
		}
	}
};
		            // actually fire the API request here.
		            casper.open('https://cascade.wm.edu/api/v1/create?u=' + user + '&p=' + pass, {
		                method: 'post',
		                headers: {
		                   'Content-Type': 'application/json; charset=utf-8'
		                }, 
		                data: data
		                });				
					}					
				});					

				// process the results, write them to a file.
				casper.then(function() {
					this.echo('POST results:');
					fs.write(curStoryStruct.filename+'-report.json', JSON.stringify(data), 'w');
					utils.dump(JSON.parse(this.getPageContent()));
				});   

				// look at the headers if you like.
				casper.then(function dumpHeaders(){
				  this.currentResponse.headers.forEach(function(header){
					console.log(header.name +': '+ header.value);
				  });
				});					
					
				});

			});
		});
	});
});

// don't forget to quit.
casper.run(function() {
    casper.exit();
});
