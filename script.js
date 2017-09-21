var Page = {
    _files: [],
    onStep: function(stepNumber) {
    	this._removeFocus();
    	var fileLength = this._files.length;
		switch(stepNumber) {
				case 1:
					// User clicked on "Select Files": let him. Always.
        			this._setStep(1);
					document.getElementById('upload-file-input').click();
					break;
				case 2:
					if (fileLength > 0) {
						this._setStep(2)
					} else {
						return;
					}	
					break;
				case 3:
					if (fileLength > 0) {
						if (this.getCipher() != '') {
							this._setStep(3);
						} else {
							return;
						}
					} else {
						return;
					}

					// Still here? Then clear error protocol and encrypt
					document.getElementById('error-file-list').innerHTML = '';
					for (var j = 0; j < this._files.length; ++j) {
						var file = this._files[j];
						if (file.name.split('.').pop().toLowerCase() == 'wfc') {
							new deCrypter(file);
						} else {
							new enCrypter(file);
						}
					}					
					break;
		}    	
    },
    onCipherKey: function(e) {
        if (e && e.keyCode == 13) {
            // User has hit enter, switch to step 3
            if (this._files.length > 0 && this.getCipher() != '' ) {
                this.onStep(3);
                return;
            }
        }
    },  
    onCipherKeyUp: function(e) {
    	// update tooltip & links
        this._setStep(2);
    },
    onFileSelect: function(event) {
    	var input = event.target;

    	if (input.files.length > 0) {
    		// User did select files. Throw the old ones away
    		this._files = [];
    	}

    	for (var i = 0; i < input.files.length; i++) {
    		this._files.push(input.files[i])
        }

		if (input.files.length > 0) {
			// User did select files
			if (this._files.length > 0) {
				// And we took them
				this.onStep(2);
			} else {
				// We didn't take them? So we don't have any files?
				this._setStep(1);  // NOT onStep(1), because that would trigger another file dialog!
			}
		} else {
			// User canceled his file selection
			this._setStep(1);
		}
    },
    onPageLoad: function() {
    	this._setStep(1);	
    },
    getCipher: function() {
    	return document.getElementById('cipher').value;	
    },
    _removeFocus: function() {
        document.activeElement.classList.remove('active');
        document.activeElement.blur();
    },
    _setStep: function(stepNumber) {
        var steps = document.querySelectorAll('.step-item');
        var pos = stepNumber - 1.
        for (var i = 0; i < steps.length; ++i) {
            steps[i].classList.remove('active');
            if (i == pos) {
                steps[i].classList.add('active');   
            }
		}

		// Hide or Show the Cipher Input Field
		var cipher = document.getElementById('cipher');
		if (stepNumber == 2) {
		    cipher.classList.remove('invisible');
		    cipher.classList.add('visible');
		    setTimeout(function(){
                document.getElementById('cipher').focus();
            }, 300); // Workaround
		} else {
		    cipher.classList.remove('visible');
            cipher.classList.add('invisible');
		}
		
		// Update Tooltips && Cursor
		for (var i = 0; i < steps.length; ++i) {
			var tooltip = '';
			var link = steps[i].getElementsByTagName('a')[0];
			link.style.cursor = 'default'; // Hide Clickability
			var fileCount = this._files.length;
			switch(i) {
				case 0:
					// Tooltip
					if (fileCount > 0) {
						if (fileCount == 1) {
							tooltip = fileCount + ' File selected';
						} else {
							tooltip = fileCount + ' Files selected';
						}
					} else {
						tooltip = 'No Files chosen';
					}

					// Step 1 is always selectable
					link.style.cursor = 'auto';
					break;
				case 1:
					// Tooltip
					if (this.getCipher() != '') {
						tooltip = 'Cipher chosen';
					} else {
						tooltip = 'No Cipher chosen';
					}

					// Cursor
					if (fileCount > 0) {
						link.style.cursor = 'auto';
					}
					break;
				case 2:
					// Tooltip
					var encrypt = 0;
					var decrypt = 0;
					for (var j = 0; j < this._files.length; ++j) {
						if (this._files[j].name.split('.').pop().toLowerCase() == 'wfc') {
							decrypt++;
						} else {
							encrypt++;
						}
					}
					if (encrypt == 0 && decrypt == 0) {
						tooltip = 'No Files chosen';
					} else {
						if (encrypt != 0) {
							tooltip = encrypt + ' Files to encrypt';
						}
						if (decrypt != 0) {
							tooltip = decrypt + ' Files to decrypt';
						}
					}

					// Cursor
					if (fileCount > 0 && this.getCipher() != '') {
						link.style.cursor = 'auto';
					}					
					break;
			}
			link.setAttribute('data-tooltip', tooltip);
		}
    },
    addError: function(file, err) {
    	var content = '';
		content += '<div class="column col-3 text-break"><div class="toast toast-error tooltip"';
		content += ' data-tooltip=' + JSON.stringify( err.toString() ) + '>';
		content += file.name;

		content += '</div></div>';
    	document.getElementById('error-file-list').innerHTML += content;	
    },
}

class crypterBase {
	constructor() {
    	if (Page.getCipher() == '') {
    		throw 'Cipher is empty';
    	}		
		this._defaultAuthData = (new Uint8Array([213, 108, 109, 126, 31, 34, 62, 55, 223, 59, 205, 42])).buffer;
	}
	_setAlgorithm(iv) {
		if (this._algorithm) {
			return;
		}

		this._algorithm = {
			name: "AES-GCM",
			iv: iv,
			additionalData: this._defaultAuthData,
			tagLength: 128, //can be 32, 64, 96, 104, 112, 120 or 128 (default)
		};	
	}
}

class enCrypter extends crypterBase {
	constructor(file) {
		super();
		this._setAlgorithm(crypto.getRandomValues(new Uint8Array(12)));

    	crypto.subtle.digest('SHA-256', stringToArrayBuffer(Page.getCipher()))
    	.then(hash => {
			return crypto.subtle.importKey('raw',    hash, 'AES-GCM',
    						       false,   ['encrypt']);
    	})
    	.then(key => { 
			var fileReader = new FileReader();
			fileReader.onload = (e) => {
				var arrayBuffer = e.target.result;
				crypto.subtle.encrypt(this._algorithm, key, arrayBuffer)
				.then(result => {
					var merged = mergeIvAndData(this._algorithm.iv.buffer, result);
					saveFile(merged, file.name + '.wfc');
				})
				.catch(err => {
					Page.addError(file, err);
				})
			};
			fileReader.readAsArrayBuffer(file);      		
    	});
  	}
}

class deCrypter extends crypterBase {
	constructor(file) {
		super();
		var fileReader = new FileReader();
		fileReader.onload = (e) => {
			var arrayBuffer = e.target.result;
			let {iv, data} = splitIvAndData(arrayBuffer);
			this._setAlgorithm(iv);
			this._data = data;
			crypto.subtle.digest('SHA-256', stringToArrayBuffer(Page.getCipher()))
			.then(hash => {
				return crypto.subtle.importKey('raw',    hash, 'AES-GCM',
							       false,   ['decrypt']);
			})
			.then(key => {
				crypto.subtle.decrypt(this._algorithm, key, this._data)
				.then(result => {
					var newFileName = file.name.substring(0, file.name.length - 4);
					// Special Case: "old" Extension contains a modifier after the extension
					if (newFileName.includes('.')) {
						var nameSplit = file.name.split('.');
						var oldExtension = nameSplit.pop();
						var oldExtensionCleaned = oldExtension.replace(/[^0-9a-zA-Z]/gi, '')
						if (oldExtension != oldExtensionCleaned) {
							newFileName = nameSplit.join('.');	
						}
					}
					saveFile(result, newFileName);
				})
				.catch(err => {
					Page.addError(file, err);
				});		
			});	
		};
    	fileReader.readAsArrayBuffer(file);
	}
}

function stringToArrayBuffer(string) {
    return new TextEncoder('utf-8').encode(string);
}

function saveFile(content, fileName) {
	var blob = new Blob([content],{type:'application/octet-stream'});
	var elem = window.document.createElement('a');
	elem.href = window.URL.createObjectURL(blob);
	var url = elem.href;
	elem.download = fileName;   
	document.body.appendChild(elem);
	elem.click();        
	document.body.removeChild(elem);
	window.URL.revokeObjectURL(url);	
}

function mergeIvAndData(iv, data) {
    var tmp = new Uint8Array(iv.byteLength + data.byteLength);
    tmp.set(new Uint8Array(iv), 0);
    tmp.set(new Uint8Array(data), iv.byteLength);
    return tmp.buffer;
}

function splitIvAndData(data) {
    var iv = data.slice(0, 12);
    var data = data.slice(12);
    return { iv, data, }
}
