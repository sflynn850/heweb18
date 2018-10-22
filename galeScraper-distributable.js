/*
*
* "The Gale" blog => Cascade importer
* by Sean Flynn - The College of William and Mary
* sflynn@wm.edu / sean.flynn@gmail.com
* v1.0 - Feb. 27, 2018: Initial import test
* v1.1 - Mar. 5, 2018: Completion & full import
*
* Notes:
*    Requires CasperJS (http://casperjs.org/); this was written against v. 1.1.4 for Mac.
*    Install CasperJS with Homebrew (https://brew.sh/); script is ready to run.
*
*/

var utils = require('utils');
var fs = require('fs');

var links = [];
var stories = [];
var casper = require('casper').create();
var baseURL = "https://wmalumni.com"
var i = 0;
var j = 0;
var articleCount = 0;

// change these to your Cascade user/password
// Due to a Hannon Hill bug, this user must be elevated
// to cascade administrator

// OR, remove all workflows from the target Cascade folder

var user = '***'
var pass = '***'


// uncomment if you need remote messages to print in your terminal
// for troubleshooting

//casper.on('remote.message', function(message) {
//    this.echo('remote message caught: ' + message);
//});


function getLinks() {
    links = document.querySelectorAll('a.storylink');
    return Array.prototype.map.call(links, function(e) {
        return e.getAttribute('href');
    });
}

casper.start('https://wmalumni.com/get-informed/gale.html?start=' + articleCount, function() {

	links = this.evaluate(getLinks);
	articleCount = 5;

	while (articleCount < 395){ // 395 gets all the articles and then runs past the end
		this.thenOpen('https://wmalumni.com/get-informed/gale.html?start=' + articleCount, function() {
			var tempArray = this.evaluate(getLinks);
			for (var k = 0; k < tempArray.length; k++){
				links.push(tempArray[k]);
			}
			utils.dump(links);
		});
	articleCount += 5;	   
	}
});

casper.then(function(){
    // behold the magic of callbacks
    this.each(links, function(){
        this.thenOpen(baseURL + links[i], function(){
           var curNewsStory = "";
           this.echo(this.getTitle()); 
           this.echo(this.getCurrentUrl()); 
            
           // do the evaluate dance
			curNewsStory = this.evaluate(function(){

				var curNewsStoryStruct = 
				{
					"title": "",
					"byline": "",
					"date": "",
					"startDate": "",
					"summary": "",
					"body": "",
					"filename": "",
					"oldImageURLs": [],
					"newImageFilenames": [],
					"thumbnailAssetID": ""
				};

				curNewsStoryStruct.filename = location.pathname.substring(location.pathname.lastIndexOf("/") + 1, location.pathname.length-5); // redact .html
				curNewsStoryStruct.title = document.querySelector('#headline').innerHTML.trim();
				curNewsStoryStruct.date = document.querySelector('#date').innerHTML.trim();
				curNewsStoryStruct.summary = document.querySelector('#summary').innerHTML.trim();

				// get the body text and ditch script tag(s)
				var bodyElement = document.querySelector('#main-content');
				while (bodyElement.querySelector('script') != null){
					bodyElement.querySelector('script').remove();
				}

				// image harvesting
				var imgNodeList = bodyElement.querySelectorAll('img');
				var ext = '';
				for (var i = 0; i < imgNodeList.length; i++ ){
					// add the old URL to the array so we can download it later
					curNewsStoryStruct.oldImageURLs.push(imgNodeList[i].src);
					// get the extension
					ext = '';
					ext = imgNodeList[i].src.substring(imgNodeList[i].src.lastIndexOf("."), imgNodeList[i].src.length);

					// change the html doc to use the new image URL
					imgNodeList[i].src = "https://advancement.wm.edu/news/images/the-gale/" + curNewsStoryStruct.filename + "-photo" + i + ext;
					curNewsStoryStruct.newImageFilenames.push(curNewsStoryStruct.filename + "-photo" + i + ext);

				}

				curNewsStoryStruct.body = bodyElement.innerHTML.trim();

				// get the byline; if we don't have one, make one.
				var bylineElement = document.querySelector('#byline');
				if (bylineElement != '' && bylineElement != null){
					curNewsStoryStruct.byline = bylineElement.innerHTML.trim();
				}
				else {
					curNewsStoryStruct.byline = "University Advancement";
				}
				
				/*** BEGIN REGEX CLEANING OF TEXT ***/


				// clean the summary
				curNewsStoryStruct.summary = curNewsStoryStruct.summary.replace(/[\u2018\u2019]/g, "'");
				curNewsStoryStruct.summary = curNewsStoryStruct.summary.replace(/[\u201C\u201D]/g, '"');
				curNewsStoryStruct.summary = curNewsStoryStruct.summary.replace(/&nbsp;/gi, ' ');
				curNewsStoryStruct.summary = curNewsStoryStruct.summary.replace(/&amp;/gi, '&');
				curNewsStoryStruct.summary = curNewsStoryStruct.summary.replace(/&mdash;/gi, '—');
				curNewsStoryStruct.summary = curNewsStoryStruct.summary.replace(/&ndash;/gi, '-');
				curNewsStoryStruct.summary = curNewsStoryStruct.summary.replace(/\s{2,}/gi, ' ');

				// clean the body
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/[\u00A0-\u9999]/gim, function(i) 
																	{  return '&#'+i.charCodeAt(0)+';'; });
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/&nbsp;/gi, ' ');
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/<\/?div[^>]*>/gi, '<br />');
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/<\/?span[^>]*>/gi, ' ');
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/&nbsp;/gi, ' ');
				
				// continually remove BRs from the start of the article
				// we could do this smarter, but
				// if it's stupid and it works
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/^\s*<br\s*\/>\s*/gi, '');	
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/^\s*<br\s*\/>\s*/gi, '');
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/^\s*<br\s*\/>\s*/gi, '');
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/^\s*<br\s*\/>\s*/gi, '');
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/^\s*<br\s*\/>\s*/gi, '');
				
				// change lots of BRs to one BR
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/(<br\s*\/>\s*){2,}/gi, '<br />');
				// remove excess spaces
				curNewsStoryStruct.body = curNewsStoryStruct.body.replace(/\s{2,}/gi, ' ');


				curNewsStoryStruct.title = curNewsStoryStruct.title.replace(/\&amp;/gi, '&');
				curNewsStoryStruct.title = curNewsStoryStruct.title.replace(/\%20/gi, ' ');
				curNewsStoryStruct.title = curNewsStoryStruct.title.replace(/[\u2018\u2019]/g, "'");
				curNewsStoryStruct.title = curNewsStoryStruct.title.replace(/[\u201C\u201D]/g, '"');


				curNewsStoryStruct.byline = curNewsStoryStruct.byline.replace(/^By\s*/gi, '');
				curNewsStoryStruct.byline = curNewsStoryStruct.byline.replace(/[\u00A0-\u9999]/gim, function(i) 
																	{  return '&#'+i.charCodeAt(0)+';'; });
				return (curNewsStoryStruct);
			});

			// if we have a valid struct, we do the things
			// -- otherwise we add the link to the end of the array and try again.
			
			// Why yes, this COULD become an infinite loop if you have 
			// a broken story, why do you ask?
			
			if (curNewsStory != null){
				
				var jsDate = new Date(curNewsStory.date);
				curNewsStory.date = jsDate;


				// this next part makes a date in the following format:
				// 'Dec 31, 1999 11:59:59 PM'
				
				var monthStruct = {
					'0':'Jan',
					'1':'Feb',
					'2':'Mar',
					'3':'Apr',
					'4':'May',
					'5':'Jun',
					'6':'Jul',
					'7':'Aug',
					'8':'Sep',
					'9':'Oct',
					'10':'Nov',
					'11':'Dec'
				};

				// yes, it has to be exactly like this
				curNewsStory.startDate = monthStruct[jsDate.getMonth()] + ' ' + jsDate.getDate() + ', ' + jsDate.getFullYear() + ' ' + jsDate.toLocaleTimeString('en-us').substr(1,jsDate.toLocaleTimeString('en-us').length - 5);
				
				
				casper.then(function() {
					// if this article has an image, fetch its assetID
					// and add it to the struct.

					if(curNewsStory.newImageFilenames.length > 0){
						var apiURL = 'https://cascade.wm.edu/api/v1/read/file/Advancement/advancement.wm.edu/news/images/the-gale/'
						var assetID = '';
						var url = '';
						// note: cascade lowercases files on import. that might be a W&M thing.
						var imageName = curNewsStory.newImageFilenames[0].toLowerCase();

						if (imageName != null && imageName != '') {
							url = apiURL + imageName + '?u=' + user + '&p=' + pass;

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
										curNewsStory.thumbnailAssetID = ret.asset.file.id; 
										curNewsStory.thumbnailAssetID = ret.asset.file.id; 
//										this.echo('got the id!')
//										utils.dump(ret.asset.file.id)
									}
									else{
										utils.dump(ret);
										utils.dump(imageName)
										this.exit();
									}
								}
							});
						}					
					}
				});


				casper.then(function() {
					// Uncomment this to download the old images. You shouldn't do this
					// AND ALSO try to import the stories at once. 
					
//					for (var i = 0; i < curNewsStory.oldImageURLs.length; i++){
//						this.download(curNewsStory.oldImageURLs[i], 'gale/images/' + curNewsStory.newImageFilenames[i]);
//					}


					if (curNewsStory.thumbnailAssetID != null && curNewsStory.thumbnailAssetID != ''){
						//push with the thumbnail
						utils.dump("Sending with thumbnail " + curNewsStory.thumbnailAssetID);
						utils.dump(curNewsStory);
						url = 'https://cascade.wm.edu/api/v1/create?u=' + user + '&p=' + pass;
						utils.dump(url);

						data = {
			                      'asset': {
			                        'page': {
			                          'contentTypeId': '649deb210a0000065fa0893b04323621',
			                          'contentTypePath': 'advancement.wm.edu/News Story',
			                          'name': curNewsStory.filename,
			                          'parentFolderPath': '/advancement.wm.edu/news/' + curNewsStory.date.getFullYear(),
			                          'siteName': 'Advancement',
			                          'structuredData': {
			                              'structuredDataNodes':
			                                [{
			                                'type': 'group',
			                                'identifier': 'content',
			                                'structuredDataNodes': [
			                                    {
			                                        'type': 'text',
			                                        'identifier': 'datePublished',
			                                        'text': curNewsStory.date.getTime(),
			                                        'recycled': false
			                                    },
			                                    {
			                                        'type':'text',
			                                        'identifier':'pageText',
			                                        'text': curNewsStory.body,
			                                        'recycled': false
			                                    }
			                                ],
											'recycled': false
			                            },
										  {
											'type': 'asset',
											'identifier': 'thumbnail',
											'fileId': curNewsStory.thumbnailAssetID,
											'filePath': 'advancement.wm.edu/news/images/' + curNewsStory.newImageFilenames[0],
											'assetType': 'file',
											'recycled': false
										  }
									  ]
			                          },
			                          'metadata': {
			                            'author':  curNewsStory.byline,
			                            'summary': curNewsStory.summary,
			                            'title':  curNewsStory.title,
										'startDate': curNewsStory.startDate,
			                            'dynamicFields':[
			                            {
			                                'name': 'category',
			                                'fieldValues': [
			                                    {
			                                        'value': 'Blog'
			                                    },
			                                    {
			                                        'value': 'Alumni'
			                                    }
			                                ]
			                            },
			
			                            {
			                                'name': 'showSiblings',
			                                'fieldValues':[
			                                    {
			                                        'value': 'Yes'
			                                    }
			                                ]
			                            }
			                           ]
			                          }
			                        }
			                      }
			                    };

						// Uncomment this to write a JSON file per story.
						// Useful for testing, if you comment out the
						// following below API POST:
//						fs.write(curNewsStory.filename+'-data.json', JSON.stringify(data), 'w');

			            casper.open(url, {
			                method: 'post',
			                headers: {
			                   'Content-Type': 'application/json; charset=utf-8'
			                }, 
			                data: data
			                });


					} else {
						//don't push with thumbnail
					utils.dump("Sending without thumbnail!");
		            casper.open('https://cascade.wm.edu/api/v1/create?u=' + user + '&p=' + pass, {
		                method: 'post',
		                headers: {
		                   'Content-Type': 'application/json; charset=utf-8'
		                }, 
		                data:   {
		                      'asset': {
		                        'page': {
		                          'contentTypeId': '649deb210a0000065fa0893b04323621',
		                          'contentTypePath': 'advancement.wm.edu/News Story',
		                          'name': curNewsStory.filename,
		                          'parentFolderPath': '/advancement.wm.edu/news/' + curNewsStory.date.getFullYear(),
		                          'siteName': 'Advancement',
		                          'structuredData': {
		                              'structuredDataNodes':
		                                [{
		                                'type': 'group',
		                                'identifier': 'content',
		                                'structuredDataNodes': [
		                                    {
		                                        'type': 'text',
		                                        'identifier': 'datePublished',
		                                        'text': curNewsStory.date.getTime(),
		                                        'recycled': false
		                                    },
		                                    {
		                                        'type':'text',
		                                        'identifier':'pageText',
		                                        'text': curNewsStory.body,
		                                        'recycled': false
		                                    }
		                                ],

										'recycled': false
		                            }]
		                          },
		                          'metadata': {
		                            'author':  curNewsStory.byline,
		                            'summary': curNewsStory.summary,
		                            'title':  curNewsStory.title,
									'startDate': curNewsStory.startDate,
		                            'dynamicFields':[
		                            {
		                                'name': 'category',
		                                'fieldValues': [
		                                    {
		                                        'value': 'Blog'
		                                    },
		                                    {
		                                        'value': 'Alumni'
		                                    }
		                                ]
		                            },
		
		                            {
		                                'name': 'showSiblings',
		                                'fieldValues':[
		                                    {
		                                        'value': 'Yes'
		                                    }
		
		                                ]
		                            }
		                           ]
		                          }
		                        }
		                      }
		                    }
		                });				
					}					
				});

            casper.then(function() {
                this.echo('POST results:');
                utils.dump(JSON.parse(this.getPageContent()));
            });   

			casper.then(function dumpHeaders(){
			  this.currentResponse.headers.forEach(function(header){
				console.log(header.name +': '+ header.value);
			  });
			});

			}
			else{
				// you can dust it off and try again, try again
				this.echo("Failed to get page: " + baseURL + links[i]);
				links.push(baseURL + links[i]);
			}

        });
        //advance the link counter
        i++;
    });
});


casper.run(function() {
    casper.exit();
});


/*

Cascade API Stuff:


URL: https://cascade.wm.edu/api/v1/create?u=$USER&p=$PASS

POST body:

'authentication': {
    'username': 'sflynn@wm.edu',
    'password': ******
}


// CREATE
// set categories to advancement, giving and campaign site
https://cascade.wm.edu/api/v1/create?u=sflynn&p=***

//https://cascade.wm.edu/api/v1/read/page/Advancement/advancement.wm.edu/news/2017/hewlett-foundation-aiddata-grant?u=$USER&p=$PASS


casper.open('https://cascade.wm.edu/api/v1/create?u=sflynn&p=***', {
    method: 'post',
    data:   {
          'asset': {
            'page': {
              'name': curNewsStory.filename,
              'parentFolderPath': '/advancement.wm.edu/news/archive/',
              'siteName': 'Advancement',
              'contentTypeId': '649deb210a0000065fa0893b04323621',
              'xhtml': curNewsStory.body,
              'metadata': {
                'author': curNewsStory.byline,
                'summary': curNewsStory.blurb,
                'title': curNewsStory.title,
                'category': 'Advancement,Giving,Campaign,Alumni'
              }
            }
          }
        }
    });

*/