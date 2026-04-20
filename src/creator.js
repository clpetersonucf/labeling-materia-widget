/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
Namespace('Labeling').Creator = (function() {
	// variables for local use
	let _context, _img, _offsetY, _qset;
	let _title = (_qset = null);

	// canvas, context, and image to render to it
	let _canvas = (_context = (_img = null));

	// offset for legacy support
	const _offsetX = (_offsetY = 0);

	//Anchor tag opacity class modifier
	let _anchorOpacity = ' ';

	// store image dimensions in case the user cancels the resize
	let _lastImgDimensions = {};

	// store crop dimensions as well
	let _lastMask = ""
	let _lastCropDimensions = {}

	// track if the user is "getting started" or well on their way
	let _gettingStarted = false;

	const _defaultLabel = 'Enter label title';
	const _defaultDescription = 'Anchor point alt text';

	const _distance = (x1, y1, x2, y2) => {
		return Math.sqrt(((x1-x2)**2) + ((y1-y2)**2))
	}

	const initNewWidget = function(widget, baseUrl) {
		$('#image').hide();
		$('#chooseimage').show();
		// prompt the user for a widget title
		$('#titlebox').addClass('show');
		$('#backgroundcover').addClass('show');

		// hide the canvas so we can interact with it
		// $('#canvas').css('display','none');

		_gettingStarted = true;

		// make a scaffold qset object
		_qset = {};
		_qset.options = {};
		_qset.options.backgroundTheme = 'themeGraphPaper';
		_qset.options.backgroundColor = 2565927;

		// set up the creator, shared between new and existing
		return _setupCreator();
	};

	var _setupCreator = function() {
		// set background and header title
		_setBackground();

		// get canvas context
		// _canvas = document.getElementById('canvas');
		// _context = _canvas.getContext('2d');
		// _context.canvas.width = $("#canvas").width()
		// _context.canvas.height = $("#canvas").height()

		_img = new Image();

		// set up event handlers
		$('.graph').click(function() {
			_qset.options.backgroundTheme = 'themeGraphPaper';
			return _setBackground();
		});

		$('.cork').click(function() {
			_qset.options.backgroundTheme = 'themeCorkBoard';
			return _setBackground();
		});

		$('.backgroundtile.color').click(function() {
			if (_qset.options.backgroundTheme !== 'themeSolidColor') {
				_qset.options.backgroundTheme = 'themeSolidColor';
				_setBackground();
			}

			$("#colorpicker").spectrum("show");
			$('.sp-coloropt').click(function(e) {
				if ((e != null) && (e.target != null)) {
					let color = e.target.style.backgroundColor.split(',');
					color = parseInt(parseInt(color[0].substring(4)).toString(16) + parseInt(color[1]).toString(16) + parseInt(color[2]).toString(16), 16);
					_qset.options.backgroundTheme = 'themeSolidColor';
					_qset.options.backgroundColor = color;
					return _setBackground();
				}
			});
			return false;
		});

		$('#opaque-toggle').change(function() {
			_anchorOpacity = ' ';
			const dots = $(document).find('.dot');
			let i = 0;
			return (() => {
				const result = [];
				while (i < dots.length) {
					$(dots[i]).removeClass('frosted transparent');
					result.push(i++);
				}
				return result;
			})();
		});

		$('#frosted-toggle').change(function() {
			_anchorOpacity = ' frosted';
			const dots = $(document).find('.dot');
			let i = 0;
			return (() => {
				const result = [];
				while (i < dots.length) {
					$(dots[i]).removeClass('transparent').addClass('frosted');
					result.push(i++);
				}
				return result;
			})();
		});

		$('#transparent-toggle').change(function() {
			_anchorOpacity = ' transparent';
			const dots = $(document).find('.dot');
			let i = 0;
			return (() => {
				const result = [];
				while (i < dots.length) {
					$(dots[i]).removeClass('frosted').addClass('transparent');
					result.push(i++);
				}
				return result;
			})();
		});

		$('#btnMoveResize').click(function() {
			_resizeMode(true);

			if (_qset.options.backgroundTheme === "themeGraphPaper") {
				$('.resizable').addClass('dark');
			} else {
				$('.resizable').removeClass('dark');
			}

			_lastImgDimensions = {
				width: $('#imagewrapper').width(),
				height: $('#imagewrapper').height(),
				left: $('#imagewrapper').position().left,
				top: $('#imagewrapper').position().top
			};
		});

		$('#btnMoveCrop').click(function() {
			_cropMode(true);

			if (_qset.options.backgroundTheme === "themeGraphPaper") {
				$('.resizable').addClass('dark');
			} else {
				$('.resizable').removeClass('dark');
			}

			_lastMask = document.getElementById("image").style.clipPath
			_lastCropDimensions = {
				width: $('#crop').width(),
				height: $('#crop').height(),
				left: $('#crop').position().left,
				top: $('#crop').position().top
			};
		});

		$('#btnMoveResizeCancel').click(function() {
			_resizeMode(false);
			$('#imagewrapper').width(_lastImgDimensions.width);
			$('#imagewrapper').height(_lastImgDimensions.height);
			$('#imagewrapper').css('left', _lastImgDimensions.left + 'px');
			$('#imagewrapper').css('top', _lastImgDimensions.top + 'px');
		});

		$('#btnMoveResizeDone').click(() => _resizeMode(false));

		$('#btnCropCancel').click(function() {
			_cropMode(false);
			$('#crop').width(_lastCropDimensions.width);
			$('#crop').height(_lastCropDimensions.height);
			$('#crop').css('left', _lastCropDimensions.left + 'px');
			$('#crop').css('top', _lastCropDimensions.top + 'px');
			document.getElementById("image").style.clipPath = _lastMask
		});

		$('#btnCropDone').click(() => _cropMode(false));

		$('#btnChangeDescription').click(function() {
			$('#descriptionchanger').addClass('show');
			$('#backgroundcover').addClass('show');
			return $('.arrow_box').addClass('hide');
		});

		$('#btnChooseImage').click(() => Materia.CreatorCore.showMediaImporter());

		$('#btn-enter-title').click(function() {
			Materia.CreatorCore.showMediaImporter();
			return true;
		});

		$('#title').click(_showMiniTitleEditor);
		$('#header .link').click(_showMiniTitleEditor);

		window.setTitle = function(title) {
			if (title == null) { title = document.getElementById("title").textContent; }
			title = title.replace(/</g, '').replace(/>/g, '');
			$('#namebox').removeClass('show');
			$('#titlechanger').removeClass('show');
			$('#backgroundcover').removeClass('show');
			return $('#title').html((title || 'My labeling widget'));
		};

		window.setImageDescription = function(alt) {
			if (alt == null) { alt = document.getElementById("alttext"); }
			$('#descriptionchanger').removeClass('show');
			$('#backgroundcover').removeClass('show');
			$('#imagedescription').html((alt||'My labeling widget'));
			return $('#image').attr('alt', alt);
		};

		document.getElementById('svglayer').addEventListener('click', _addTerm, false);

		// update background
		$('#colorpicker').spectrum({
			move: _updateColorFromSelector,
			cancelText: '',
			chooseText: 'Done'
		});

		document.getElementById("letsgo-btn").addEventListener("click", (e)=>{
			document.getElementById("titlebox").classList.remove("show");
			document.getElementById("namebox").classList.add("show");
		})
	};

	var _showMiniTitleEditor = function() {
		$('#titlechanger').addClass('show');
		$('#backgroundcover').addClass('show');
		return $('#titletxt').val($('#title').html()).focus();
	};

	const _makeDraggable = () => { // drag all sides of the image for resizing
		$('#imagewrapper').draggable({
			drag(event,ui) {
				return ui;
			}
		}).resizable({
			aspectRatio: true,
			handles: 'n, e, s, w, ne, nw, se, sw',
		});
		

		$('#crop').draggable({
			containment: "parent",
			drag: (e ,ui) => {
				const imgRect = document.getElementById("imagewrapper").getBoundingClientRect()
				const rect = document.getElementById("crop").getBoundingClientRect()
				document.getElementById("image").style.clipPath = 
				`rect(${ui.position.top+"px"} ${((rect.width+ui.position.left)/imgRect.width*100)+"%"} ${((rect.height+ui.position.top)/imgRect.height*100)+"%"} ${ui.position.left+"px"})`
			}
		}).resizable({
			aspectRatio: false,
			handles: 'n, e, s, w, ne, nw, se, sw',
			containment: "parent",
			resize: (e, ui) => {
				const imgRect = document.getElementById("imagewrapper").getBoundingClientRect()
				document.getElementById("image").style.clipPath = 
				`rect(${ui.position.top+"px"} ${((ui.size.width+ui.position.left)/imgRect.width*100)+"%"}${((ui.size.height+ui.position.top)/imgRect.height*100)+"%"} ${ui.position.left+"px"})`
			}
		});
		
		$('.ui-resizable-se').removeClass('ui-icon ui-icon-gripsmall-diagonal-se');
	}

	const _enableCrop = () => {
		
	}

	// sets resize mode on and off, and sets UI accordingly
	var _resizeMode = function(isOn) {
		$('#terms').css('display', isOn ? 'none' : 'block');
		$('#svglayer').css('display', isOn ? 'none' : 'block');
		$('#maincontrols').css('display', isOn ? 'none' : 'block');
		$('#resizecontrols').css('display', isOn ? 'flex' : 'none');

		$('#crop').resizable("option", "disabled", true)
		$('#crop').draggable("option", "disabled", true)
		$('#imagewrapper').resizable("option", "disabled", false)
		$('#imagewrapper').draggable("option", "disabled", false)

		$('#btnCropCancel').css('display', 'none');
		$('#btnCropDone').css('display','none');

		if (isOn) {
			$('#imagewrapper').addClass('resizable');
			$('#controlcover').addClass('show');
			document.getElementById("crop").classList.add("ignore")
			$('#btnMoveResizeCancel').css('display', 'block');
			$('#btnMoveResizeDone').css('display','block');
		} else {
			$('#imagewrapper').removeClass('resizable');
			$('#controlcover').removeClass('show');
			document.getElementById("crop").classList.remove("ignore")
			$('#btnMoveResizeCancel').css('display', 'none');
			$('#btnMoveResizeDone').css('display','none');
		}
	};

	// sets crop mode on and off, and sets UI accordingly
	var _cropMode = function(isOn) {
		const iw = document.getElementById("imagewrapper")

		$('#terms').css('display', isOn ? 'none' : 'block');
		$('#svglayer').css('display', isOn ? 'none' : 'block');
		$('#maincontrols').css('display', isOn ? 'none' : 'block');
		$('#resizecontrols').css('display', isOn ? 'flex' : 'none');

		$('#crop').resizable("option", "disabled", false)
		$('#crop').draggable("option", "disabled", false)
		$('#imagewrapper').resizable("option", "disabled", true)
		$('#imagewrapper').draggable("option", "disabled", true)

		$('#btnMoveResizeCancel').css('display', 'none');
		$('#btnMoveResizeDone').css('display','none');

		if (isOn) {
			$('#crop').addClass('resizable');
			$('#controlcover').addClass('show');
			document.getElementById("crop").classList.add("show")

			$('#btnCropCancel').css('display', 'block');
			$('#btnCropDone').css('display','block');

			iw.style.backgroundImage = iw.dataset.bg
			iw.classList.add("showimage")
		} else {
			$('#crop').removeClass('resizable');
			$('#controlcover').removeClass('show');
			document.getElementById("crop").classList.remove("show")
			$('#btnCropCancel').css('display', 'none');
			$('#btnCropDone').css('display','none');

			iw.style.backgroundImage = ""
			iw.classList.remove("showimage")
		}
	};

	// set background color, called from the spectrum events
	var _updateColorFromSelector = function(color) {
		_qset.options.backgroundTheme = 'themeSolidColor';
		_qset.options.backgroundColor = parseInt(color.toHex(),16);
		return _setBackground();
	};

	// sets background from the qset
	var _setBackground = function() {
		let background;
		$('.backgroundtile').removeClass('show');

		// set background
		_qset.options.backgroundTheme = ""
		_qset.options.backgroundColor = "#294A42"
		switch (_qset.options.backgroundTheme) {
			case 'themeGraphPaper':
				background = 'url(assets/labeling-graph-bg.png)';
				$('.graph').addClass('show');
				break;
			case 'themeCorkBoard':
				background = 'url(assets/labeling-cork-bg.jpg)';
				$('.cork').addClass('show');
				break;
			default:
				// convert to hex and zero pad the background, which is stored as an integer
				background = '#' + ('000000' + _qset.options.backgroundColor.toString(16)).substr(-6);
				$('.color').addClass('show');
				$('#curcolor').css('background',background);
		}

		return $('#board').css('background',background);
	};

	const initExistingWidget = function(title,widget,qset,version,baseUrl) {
		_qset = qset;

		_setupCreator();
		_makeDraggable();

		// get asset url from Materia API (baseUrl and all)
		const url = Materia.CreatorCore.getMediaUrl(_qset.options.image.id);

		// render the image inside of the imagewrapper
		$('#image').attr('src', url);
		$('#image').attr('data-imgid', _qset.options.image.id);

		// load the image resource via JavaScript for rendering later
		_img.src = url;
		document.getElementById("imagewrapper").dataset.bg = `url(${url})`
		_img.onload = function() {
			$('#imagewrapper').css('height', (_img.height * _qset.options.imageScale));
			return $('#imagewrapper').css('width', (_img.width * _qset.options.imageScale));
		};
		_img.alt = _qset.options.image.alt || '';

		// set the image alt
		$('#image').attr('alt', _img.alt);
		$('#alttxt').val(_img.alt);
		$('#imagedescription').html(_img.alt);

		// if image has no description, prompt creator make one
		if (_img.alt === '') {
			$('.arrow_box').removeClass('hide');
		}

		// set the resizable image wrapper to the size and pos from qset
		$('#imagewrapper').css('left', (_qset.options.imageX));
		$('#imagewrapper').css('top', (_qset.options.imageY));

		// set the title from the qset
		$('#title').html(title);
		_title = title;

		// add qset terms to the list
		// legacy support:
		let questions = qset.items;
		if ((questions[0] != null) && questions[0].items) {
			questions = questions[0].items;
		}
		return Array.from(questions).map((item) =>
			_makeTerm(item.options.endPointX, item.options.endPointY, item.questions[0].text, item.options.labelBoxX, item.options.labelBoxY, item.id, item.options.description || _defaultDescription));
	};

	// draw lines on the board
	const _drawBoard = function() {
		// iterate every term and read dot attributes
		for (var term of Array.from($('.term'))) {
			var dotx = parseInt(term.getAttribute('data-x'));
			var doty = parseInt(term.getAttribute('data-y'));

			// read label position from css
			var labelx = parseInt(term.style.left);
			var labely = parseInt(term.style.top);

			let line = document.getElementById("line_"+term.id)
			let grad = document.getElementById("grad_"+term.id)

			let x1 = dotx + 2
			let y1 = doty + 2
			let x2 = labelx + 85
			let y2 = labely + 30

			let dist = _distance(x1, y1, x2, y2)

			grad.setAttribute("x1", x1 < x2 ? 0 : Math.abs(x1-x2)/dist)
			grad.setAttribute("y1", y1 < y2 ? 0 : Math.abs(y1-y2)/dist)
			grad.setAttribute("x2", x2 < x1 ? 0 : Math.abs(x1-x2)/dist)
			grad.setAttribute("y2", y2 < y1 ? 0 : Math.abs(y1-y2)/dist)

			line.setAttribute("x1", x1)
			line.setAttribute("y1", y1)
			line.setAttribute("x2", x2)
			line.setAttribute("y2", y2)
		}
	};

	// Add term to the list, called by the click event
	var _addTerm = function(e) {
		// draw a dot on the canvas for the question location
		let topMargin = ($("body").height() - $("#frame").outerHeight()) / 2
		_makeTerm(e.pageX-document.getElementById('frame').offsetLeft-document.getElementById('board').offsetLeft, e.pageY-50-topMargin);

		$('#help_adding').css('display','none');
		$('#boardcover').css('display','none');
		$('#imagewrapper').removeClass('faded');

		return setTimeout(function() {
			$('#help_moving').css('display','block');
			$('#btnMoveResize').css('display','block');
			return $('#btnChooseImage').css('display','block');
		}
		,400);
	};

	// generate a term div
	var _makeTerm = function(x, y, text, labelX=null, labelY=null, id, description) {
		if (text == null) { text = _defaultLabel; }
		if (id == null) { id = ''; }
		if (description == null) { description = _defaultDescription; }
		const dotx = x;
		const doty = y;		

		const term = document.importNode(document.getElementById("term_template").content.firstElementChild, true)
		
		term.id = 'term_' + Math.random(); // fake id for linking with dot
		// term.innerHTML = "<div class='label-title-header'>Label Title</div><div class='label-input' id='text-input' tabindex='0' contenteditable='true' onkeypress='return (this.innerText.length <= 400)'>"+text+"</div><div class='alt-text-header'>Label Description</div><div class='description-input' id='text-input' contenteditable='true' tabindex='0' onkeypress='return (this.innerText.length <= 400)'>" + description + "</div><div class='delete'></div><div class='confirm'></div><div class='expand'></div>";
		term.className = 'term';
		term.querySelector(".label-input").innerHTML = text
		term.querySelector(".description-input").innerHTML = description

		console.log(text)
		
		// if we're generating a generic one, decide on a position
		if ((labelX === null) || (labelY === null)) {
			y = (y - 200);

			const labelAreaHalfWidth = 500 / 2;
			const labelAreaHalfHeight = 500 / 2;

			const labelStartOffsetX = 70;
			const labelStartOffsetY = 50;

			if (x < labelAreaHalfWidth) {
				x -= labelStartOffsetX;

				if (y < labelAreaHalfHeight) {
					y += labelStartOffsetY;
				} else {
					y -= labelStartOffsetY;
				}
			} else {
				x += labelStartOffsetX;

				if (y < labelAreaHalfHeight) {
					y += labelStartOffsetY;
				} else {
					y -= labelStartOffsetY;
				}
			}

			if (y < 150) {
				y = 150;
			}

			if (x > 450) {
				x = 450;
			}
			if (x < 100) {
				x = 100;
			}
		} else {
			x = labelX;
			y = labelY;
		}

		// set term location and dot attribute
		term.style.left = x + 'px';
		term.style.top = y + 'px';
		term.setAttribute('data-x', dotx);
		term.setAttribute('data-y', doty);
		term.setAttribute('data-id', id);

		$('#terms').append(term);

		const dot = document.createElement('div');
		dot.className = 'dot' + _anchorOpacity;
		dot.style.left = dotx + 'px';
		dot.style.top = doty + 'px';
		dot.setAttribute('data-termid', term.id);
		dot.id = "dot_" + term.id;

		$('#terms').append(dot);

		let x1 = dotx + 2
		let y1 = doty + 2
		let x2 = x + 85
		let y2 = y + 30

		let dist = _distance(x1, y1, x2, y2)

		let grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient")
		grad.id = "grad_"+term.id
		grad.setAttribute("x1", x1 < x2 ? 0 : Math.abs(x1-x2)/dist)
		grad.setAttribute("y1", y1 < y2 ? 0 : Math.abs(y1-y2)/dist)
		grad.setAttribute("x2", x2 < x1 ? 0 : Math.abs(x1-x2)/dist)
		grad.setAttribute("y2", y2 < y1 ? 0 : Math.abs(y1-y2)/dist)
		grad.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink")
		grad.setAttribute("href", "#core-gradient")

		document.getElementById("defs").appendChild(grad)

		let line = document.createElementNS("http://www.w3.org/2000/svg", "line")
		line.id = "line_"+term.id
		line.setAttribute("x1", x1)
		line.setAttribute("y1", y1)
		line.setAttribute("x2", x2)
		line.setAttribute("y2", y2)
		line.setAttribute("stroke", `url(#${grad.id})`)

		document.getElementById("svglayer").appendChild(line)

		// edit on click
		console.log(term.childNodes)
		term.childNodes[2].onclick = function() {
			term.childNodes[2].focus();
			return document.execCommand('selectAll',false,null);
		};
		term.childNodes[4].onclick = function() {
			term.childNodes[4].focus();
			return document.execCommand('selectAll',false,null);
		};

		term.childNodes[2].onfocus = () => document.execCommand('selectAll',false,null);

		term.childNodes[4].onfocus = () => document.execCommand('selectAll',false,null);

		// // resize text on change
		// term.childNodes[2].onkeyup = _termKeyUp;
		// term.childNodes[4].onkeyup = _termKeyUp;
		// // set initial font size
		// term.childNodes[2].onkeyup({target: term.childNodes[2]});
		// term.childNodes[4].onkeyup({target: term.childNodes[4]});

		// enter key press should stop editing
		term.childNodes[2].onkeydown = _termKeyDown;
		term.childNodes[4].onkeydown = _termKeyDown;

		// check if blank when the text is cleared
		term.childNodes[2].onblur = e => _termBlurred(term.childNodes[2], 3);
		term.childNodes[4].onblur = e => _termBlurred(term.childNodes[2], 3);

		// clean up pasted content to make sure we don't accidentally get invisible html garbage
		term.childNodes[2].onpaste = _termPaste;
		term.childNodes[4].onpaste = _termPaste;

		// make delete button remove it from the list
		term.childNodes[5].onclick = function() {
			term.parentElement.removeChild(term);
			dot.parentElement.removeChild(dot);
			line.parentElement.removeChild(line)
			grad.parentElement.removeChild(grad)
			return _drawBoard();
		};

		// remove focus, thus deselecting it
		term.childNodes[6].onclick = function(e) {
			e.preventDefault()
			e.stopPropagation()
			term.childNodes.forEach((v)=>v.blur())
			window.getSelection().removeAllRanges();
		};

		// make the term movable
		$(term).draggable({
			drag(event,ui) {
				if (ui.position.left < 20) {
					ui.position.left = 20;
				}
				if (ui.position.left > 460) {
					ui.position.left = 460;
				}
				if (ui.position.top > 505) {
					ui.position.top = 505;
				}
				if (ui.position.top < 20) {
					ui.position.top = 20;
				}
				_drawBoard();
				return ui;
			}
		});
		// make the dot movable
		$(dot).draggable({
			drag: _dotDragged
		});
		setTimeout(function() {
			term.childNodes[4].focus();
			return document.execCommand('selectAll',false,null);
		}
		,10);

		return _drawBoard();
	};

	// When typing on a term, resize the font accordingly
	var _termKeyUp = function(e) {
		if ((e == null)) { e = window.event; }
		let fontSize = (16 - (e.target.innerHTML.length / 10));
		if (fontSize < 12) { fontSize = 12; }
		return e.target.style.fontSize = fontSize + 'px';
	};

	// When typing on a term, resize the font accordingly
	var _termKeyDown = function(e) {
		if ((e == null)) { e = window.event; }

		// Enter key
		// block adding line returns
		// consider Enter Key to mean 'done editing'
		if (e.keyCode === 13) {
			// Defocus
			e.target.blur();
			window.getSelection().removeAllRanges(); // needed for contenteditable blur
			// put event in a sleeper hold
			if (e.stopPropagation != null) { e.stopPropagation(); }
			e.preventDefault();
			if (e.target.id === "text-input") {
				e.target.parentElement.childNodes[2].focus();
			}
			return false;
		}


		// Escape
		if (e.keyCode === 27) {
			if (e.target.innerHTML.length < 1) {
				$(document.getElementById('dot_'+e.target.parentElement.id)).remove();
				$(e.target.parentElement).remove();
				return _drawBoard();
			} else {
				// Defocus
				e.target.blur();
				return window.getSelection().removeAllRanges(); // needed for contenteditable blur
			}
		}
	};

	// If the term is blank, put dummy text in it
	var _termBlurred = function(target, type) {
		if (type === 0) {
			if (target.innerHTML === '') { return target.innerHTML = _defaultLabel; }
		} else if (type === 2) {
			if (target.innerHTML === '') { return target.innerHTML = _defaultDescription; }
		}
	};

	// Convert anything on the clipboard into pure text before pasting it into the label
	var _termPaste = function(e) {
		let clipboardArgument, clipboardData, input;
		if (e == null) { e = window.event; }
		e.preventDefault();

		// contenteditable divs will insert an empty <br/> when they're empty, this checks for and removes them on paste
		if (e.target.tagName === 'BR') {
			input = e.target.parentElement;
			e.target.parentElement.removeChild(e.target);
		} else {
			input = e.target;
		}
		// ie11 has different arguments for clipboardData and makes it a method of window instead of the paste event
		if (e.clipboardData != null) {
			({
                clipboardData
            } = e);
			clipboardArgument = 'text/plain';
		} else {
			({
                clipboardData
            } = window);
			clipboardArgument = 'Text';
		}

		const sel = window.getSelection();
		if (sel.rangeCount) {
			const range = sel.getRangeAt(0);
			range.deleteContents();

			const newText = clipboardData.getData(clipboardArgument);
			const newNode = document.createTextNode(newText);
			range.insertNode(newNode);

			const newRange = document.createRange();
			newRange.selectNodeContents(newNode);
			newRange.collapse(false);

			sel.removeAllRanges();
			return sel.addRange(newRange);
		}
	};


	// a dot has been dragged, lock it in place if its within 10px
	var _dotDragged = function(event,ui) {
		let minDist = 9999;
		let minDistEle = null;

		for (var dot of Array.from($('.dot'))) {
			if (dot === event.target) {
				continue;
			}
			var dist = Math.sqrt(Math.pow((ui.position.left - $(dot).position().left),2) + Math.pow((ui.position.top - $(dot).position().top),2));
			if (dist < minDist) {
				minDist = dist;
				minDistEle = dot;
			}
		}

		// less than 10px away, put the dot where the other one is
		// this is how duplicates are supported
		if (minDist < 10) {
			ui.position.left = $(minDistEle).position().left;
			ui.position.top = $(minDistEle).position().top;
		}

		const term = document.getElementById(event.target.getAttribute('data-termid'));
		term.setAttribute('data-x', ui.position.left);
		term.setAttribute('data-y', ui.position.top);

		return _drawBoard();
	};

	// called from Materia creator page
	const onSaveClicked = function(mode) {
		if (mode == null) { mode = 'save'; }
		if (!_buildSaveData()) {
			return Materia.CreatorCore.cancelSave('Widget needs a title, at least one term, and a description of the image.');
		}
		return Materia.CreatorCore.save(_title, _qset);
	};

	const onSaveComplete = (title, widget, qset, version) => true;

	// called from Materia creator page
	// place the questions in an arbitrary location to be moved
	const onQuestionImportComplete = items => Array.from(items).map((item) =>
        _makeTerm(150,300,item.questions[0].text,null,null,item.id,item.options.description || _defaultDescription));

	// generate the qset
	var _buildSaveData = function() {
		if ((_qset == null)) { _qset = {}; }
		if ((_qset.options == null)) { _qset.options = {}; }

		const words = [];

		_qset.assets = [];
		_qset.rand = false;
		_qset.name = '';
		_title = $('#title').html();
		let _okToSave = (_title != null) && (_title !== '') ? true : false;

		const items = [];

		const dots = $('.term');
		for (var dot of Array.from(dots)) {
			var item = {};
			var label = dot.childNodes[2].innerHTML;
			var description = dot.childNodes[4].innerHTML;
			if (description === _defaultDescription) {
				description = '';
			}

			var answer = {
				text: label,
				value: 100,
				id: ''
			};
			item.answers = [answer];
			item.assets = [];
			var question =
				{text: label};
			item.questions = [question];
			item.type = 'QA';
			item.id = dot.getAttribute('data-id') || '';
			item.options = {
				description,
				labelBoxX: parseInt(dot.style.left.replace('px','')),
				labelBoxY: parseInt(dot.style.top.replace('px','')),
				endPointX: parseInt(dot.getAttribute('data-x')),
				endPointY: parseInt(dot.getAttribute('data-y'))
			};

			items.push(item);
		}

		_qset.items = items;

		if (items.length < 1) {
			_okToSave = false;
		}

		let _anchorOpacityValue = 1.0;
		if (_anchorOpacity.indexOf('frosted') > -1) {
			_anchorOpacityValue = 0.5;
		} else if (_anchorOpacity.indexOf('transparent') > -1) {
			_anchorOpacityValue = 0.0;
		}

		if ($('#image').attr('alt') === '') {
			_okToSave = false;
		}

		_qset.options = {
			backgroundTheme: _qset.options.backgroundTheme,
			backgroundColor: _qset.options.backgroundColor,
			imageScale: $('#imagewrapper').width() / _img.width,
			image: {
				id: $('#image').attr('data-imgid'),
				materiaType: "asset",
				alt: $('#image').attr('alt')
			},
			imageX: $('#imagewrapper').position().left,
			imageY: $('#imagewrapper').position().top,
			imageMask: document.getElementById("image").style.clipPath,
			opacity: _anchorOpacityValue
		};

		_qset.version = "3";

		return _okToSave;
	};

	// called from Materia creator page
	// loads and sets appropriate data for loading image
	const onMediaImportComplete = function(media) {
		$('#svglayer').css('display','block');

		const url = Materia.CreatorCore.getMediaUrl(media[0].id);
		$('#chooseimage').hide();
		$('#image').show();
		$('#image').attr('src', url);
		$('#image').attr('data-imgid', media[0].id);

		$('#descimage').attr('src', url);
		$('#descimage').attr('data-imgid', media[0].id);
		_img.src = url;
		document.getElementById("imagewrapper").dataset.bg = `url(${url})`
		_img.onload = function() {
			let height, width;
			const iw = $('#imagewrapper');
			if (_img.width > _img.height) {
				width = 570;
				iw.css('width', width);
				iw.css('height', ((_img.height * iw.width()) / _img.width));
			} else {
				height = 470;
				iw.css('height', height);
				iw.css('width', ((_img.width * iw.height()) / _img.height));
			}

			$('#imagewrapper').css('left', (600 / 2) - (iw.width() / 2));
			return $('#imagewrapper').css('top', (550 / 2) - (iw.height() / 2));
		};
		_img.alt = "";

		// add image description dialog
		$('#descriptionchanger').addClass('show');
		$('#backgroundcover').addClass('show');

		_makeDraggable();

		return true;
	};

	// Public members
	return {
		initNewWidget,
		initExistingWidget,
		onSaveClicked,
		onMediaImportComplete,
		onQuestionImportComplete,
		onSaveComplete
	};
})();
