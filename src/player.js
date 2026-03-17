/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
Namespace('Labeling').Engine = (function() {
	let _qset = null;
	let _questions = null;
	let _labels = null;

	// cache element lookups
	const _domCache = {};

	// the image asset
	let _img = null;

	// reference to canvas drawing board
	let _canvas = null;
	let _context = null;

	// the current dragging term
	let _curterm = null;

	// track whether mouse is currently dragging or not
	let _isDragging = false;

	// track whether dragged item was placed
	let _wasPlaced = false;

	// track which pass keyboard is on
	const _onlyUnfilled = true;

	// track how many labels have been visited in current pass
	const _numVisited = 0;

	// track where the keyboard focus was before opening modal
	let _prevFocus = null;

	// track whether any dialog is open
	let _dialogOpen = false;

	// anchor tag opacity
	let _anchorOpacityValue = 1.0;

	// the current match the term is in proximity of
	let _curMatch = null;

	// the current 'page', i.e. the scrolling on the terms
	let _curPage = 0;

	// the text arranged by question id
	let _labelTextsByQuestionId = {};

	// legacy support; older qsets are relative to window
	let _offsetX = 0;
	let _offsetY = 0;

	// state of the puzzle completion
	let _isPuzzleComplete = false;

	// zIndex of the terms, incremented so that the dragged term is always on top
	let _zIndex = 11000;

	// getElementById and cache it, for the sake of performance
	const _g = id => _domCache[id] || (_domCache[id] = document.getElementById(id));

	const _imageXMargin = () => parseInt(window.getComputedStyle(document.getElementById('image')).marginLeft.replace("px",""))
	const _imageYMargin = () => parseInt(window.getComputedStyle(document.getElementById('image')).marginTop.replace("px",""))

	// Called by Materia.Engine when your widget Engine should start the user experience.
	const start = function(instance, qset, version) {
		//document.oncontextmenu = ->	false
		//document.addEventListener 'mousedown', (e) ->
		//	if e.button is 2 then false else true
		//window.onselectstart =
		//document.onselectstart = (e) ->
		//	e.preventDefault() if e and e.preventDefault
		//	false

		let background;
		if (version == null) { version = '1'; }
		_qset = qset;

		_questions = _qset.items;
		_labels = _qset.items;
		if (_questions[0].items) {
			_questions = _questions[0].items;
			_labels = _questions[0].items;
		}

		// deal with some legacy qset things
		if (_qset.options.version === 2) {
			_offsetX = -195;
			_offsetY = -45;
		}

		if ((_qset.options.opacity !== null) && (_qset.options.opacity !== undefined)) {
			_anchorOpacityValue = _qset.options.opacity;
		} else {
			_anchorOpacityValue = 1.0;
		}

		// set background
		switch (_qset.options.backgroundTheme) {
			case 'themeGraphPaper':
				background = 'url(assets/labeling-graph-bg.png)';
				break;
			case 'themeCorkBoard':
				background = 'url(assets/labeling-cork-bg.jpg)';
				break;
			default:
				// convert to hex and zero pad the background, which is stored as an integer
				background = '#' + ('000000' + _qset.options.backgroundColor.toString(16)).substr(-6);
		}

		// set background and header title
		_g('board').style.background = background;
		if ((instance.name === undefined) || null) {
			instance.name = "Widget Title Goes Here";
		}
		_g('title').innerHTML = instance.name;
		_g('title').style['font-size'] = ((20 - (instance.name.length / 30)) + 'px');
		_g('instructions-header').setAttribute('aria-label',  "Welcome to " + instance.name + ", a labeling game! How to play: ");

		// set events
		_g('nextbtn').addEventListener('mousedown', function() {
			_curPage++;
			return _arrangeList();
		});
		_g('prevbtn').addEventListener('mousedown', function() {
			_curPage--;
			return _arrangeList();
		});
		_g('checkBtn').addEventListener('click', () => _submitAnswers());
		_g('cancelbtn').addEventListener('click', _hideDialogs);
		_g('backgroundcover').addEventListener('click', _hideDialogs);
		_g('instructionsBtn').addEventListener('click', _showInstructions);
		document.addEventListener('keydown', _keyboardEvent);

		// get canvas context
		_canvas = _g('image');
		_context = _canvas.getContext('2d');

		// draw preview board for intro animation
		if (navigator.userAgent.indexOf("IE 9") === -1) {
			_g('backgroundcover').classList.add('show');
			_drawPreviewBoard();
		} else {
			_g('previewbox').style.display = 'none';
		}

		// load the image asset
		// when done, render the board
		_img = new Image();
		_img.onload = _drawBoard;

		_img.src = Materia.Engine.getImageAssetUrl((
			_qset.options.image ? _qset.options.image.id : _qset.assets[0]));
		_img.alt = _qset.options.image && _qset.options.image.alt ? _qset.options.image.alt : "No description provided. Please contact author of this widget for an image description.";
		_canvas.setAttribute('aria-label', _qset.options.image && _qset.options.image.alt ? _qset.options.image.alt : "No description provided. Please contact author of this widget for an image description.");

		// create term divs
		for (var question of Array.from(_questions)) {
			if (!question.id) {
				question.id = 'q'+Math.random();
			}

			question.mask = 'm'+Math.random();

			var term = document.createElement('div');
			term.id = 'term_' + question.mask;
			term.className = 'term unplaced';
			term.innerHTML = question.questions[0].text;
			term.setAttribute('aria-label', "Now on label: " + question.questions[0].text + ", currently unplaced");
			term.addEventListener('mousedown', _mouseDownEvent, false);
			term.addEventListener('touchstart', _mouseDownEvent, false);
			term.addEventListener('MSPointerDown', _mouseDownEvent, false);
			term.addEventListener('focus', _selectTerm, false);
			term.addEventListener('blur', _deselectTerm, false);
			term.setAttribute("tabindex", 0);

			var fontSize = (15 - (question.questions[0].text.length / 10));
			if (fontSize < 12) { fontSize = 12; }
			term.style.fontSize = fontSize + 'px';

			// Some legacy qsets store these as strings, which we certainly don't want
			question.options.endPointX = parseInt(question.options.endPointX);
			question.options.endPointY = parseInt(question.options.endPointY);
			question.options.labelBoxX = parseInt(question.options.labelBoxX);
			question.options.labelBoxY = parseInt(question.options.labelBoxY);

			_g('unplaced-terms').appendChild(term);
		}

		// do the shuffle
		_labels = _questions;
		_questions = _shuffle(_questions);
		_labels = _shuffle(_labels);

		// defer such that it is run once the labels are ready in the DOM
		setTimeout(function() {
			_arrangeList();
			return Array.from(document.getElementsByClassName('term')).map((node) =>
				node.classList.add('ease'));
		}
		, 0);

		// attach document listeners
		document.addEventListener('touchend', _mouseUpEvent, false);
		document.addEventListener('mouseup', _mouseUpEvent, false);
		document.addEventListener('MSPointerUp', _mouseUpEvent, false);
		document.addEventListener('touchmove', _mouseMoveEvent, false);
		document.addEventListener('MSPointerMove', _mouseMoveEvent, false);
		document.addEventListener('mousemove', _mouseMoveEvent, false);

		// handle rescaling term positions
		window.addEventListener('resize', (e) => {
			const placed = document.getElementById("placed-terms")

			// set each term offset to the current margin + magic number
			for (const child of placed.children) {
				child.style.left = (-28 + _imageXMargin())+"px"
			}
		})

		console.log(_imageXMargin())
		console.log(_imageYMargin())

		// once everything is drawn, set the height of the player
		return Materia.Engine.setHeight();
	};

	// https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
	var _shuffle = function(array) {
		let counter = array.length;

		while (counter > 0) {
			var index = Math.floor(Math.random() * counter);

			counter--;

			var temp = array[counter];
			array[counter] = array[index];
			array[index] = temp;
		}

		return array;
	};

	var _drawPreviewBoard = function() {
		// the locations of the dots on the map
		const dots = [ [160,80], [200,110], [130,120] ];
		const lines = [ [166,78,100,20], [200,110,150,90], [130,120,80,140] ];

		// the initial board has all dots
		let context = _g('previewimg0').getContext('2d');
		for (var dot of Array.from(dots)) {
			_drawDot(dot[0],dot[1],6,2,context,'rgba(0,0,0,' + _anchorOpacityValue + ')','rgba(255,255,255,' + _anchorOpacityValue + ')');
		}

		// each subsequent board has its dot and line
		for (let i = 0; i <= 2; i++) {
			context = _g('previewimg'+(i+1)).getContext('2d');
			_drawStrokedLine(lines[i][0] - _offsetX,lines[i][1] - _offsetY,lines[i][2] - _offsetX,lines[i][3] - _offsetY,'#fff','#000',context);
			_drawDot(dots[i][0],dots[i][1],6,2,context,'rgba(255,255,255,' + _anchorOpacityValue + ')','rgba(0,0,0,' + _anchorOpacityValue + ')');
		}

		return _g('gotitbtn').addEventListener('click', _hideDialogs);
	};

	// arrange the items in the left list
	var _arrangeList = function() {
		// the maximum height the terms can pass before we overflow onto another page
		let offScreen;
		const MAX_HEIGHT = 490;

		// if we went too far back, go to the 0th page
		if (_curPage < 0) { _curPage = 0; }

		// position of the terms
		let y = 10 + (-440 * _curPage);

		// state sentinels
		let maxY = 0;
		let found = false;

		// move all the unplaced terms to the left list
		const unplacedTerms = document.querySelectorAll('.unplaced');
		for (var node of Array.from(unplacedTerms)) {
			node.style.transform =
			(node.style.msTransform =
			(node.style.webkitTransform = 'translate(50px,'+y+'px)'));

			// too high up, put it on the previous page
			if (y < 10) {
				node.style.zIndex = -1;
				offScreen = true;
			// too far down, put it on the next page
			} else if (y >= MAX_HEIGHT) {
				node.style.zIndex = -1;
			// just right goldilocks
			} else {
				node.style.zIndex = '';
				node.style.opacity = 1;
				found = true;
			}

			maxY = y;
			y += node.getBoundingClientRect().height + 10;
		}

		// hide buttons if they should not be visible
		_g('nextbtn').style.opacity = maxY >= MAX_HEIGHT ? 1 : 0;
		_g('prevbtn').style.opacity = offScreen ? 1 : 0;
		_g('prevbtn').style['z-index'] = offScreen ? '9999' : '0';

		// these covers provide padding to the terms during tweening
		if (maxY >= MAX_HEIGHT) {
			_g('blockbottom').classList.remove('hide');
		} else {
			_g('blockbottom').classList.add('hide');
		}
		if (offScreen) {
			_g('blocktop').classList.remove('hide');
		} else {
			_g('blocktop').classList.add('hide');
		}

		// if nothing was found, the page is empty and we should go back automagically
		if (!found && (_curPage > 0)) {
			_curPage--;
			return _arrangeList();
		} else {
			// no more terms, we're done!
			if (!found && (_curPage === 0)) {
				_g('donearrow').style.display = 'block';
				_g('checkBtn').classList.add('done');
				return _isPuzzleComplete = true;
			// jk, reset the state
			} else {
				_g('donearrow').style.display = 'none';
				_g('checkBtn').classList.remove('done');
				return _isPuzzleComplete = false;
			}
		}
	};

	// when a term is mouse downed
	var _mouseDownEvent = function(e) {
		if ((e == null)) { e = window.event; }

		_isDragging = true;

		// show ghost term (but keep the opacity at 0)
		_g('ghost').style.display = 'inline-block';

		// set current dragging term
		_curterm = e.target;
		_curterm.style.zIndex = ++_zIndex;

		// disable easing while it drags
		e.target.className = 'term unplaced moving';

		// if it's been placed, remove that association
		if (_curterm.getAttribute('data-placed')) {
			_labelTextsByQuestionId[_curterm.getAttribute('data-placed')] = '';
			_curterm.removeAttribute('data-placed');
			_wasPlaced = true;
		}

		// don't scroll the page on an iPad
		e.preventDefault();
		if (e.stopPropagation != null) { return e.stopPropagation(); }
	};

	var _selectTerm = function(e) {
		_curterm = e.target;
		return _isDragging = false;
	};

	var _deselectTerm = function(e) {
		if (_curterm === e.target) {
			_curterm = null;
			_curMatch = null;
			return _drawBoard();
		}
	};

	var _keyboardEvent = function(e) {
		// if a term has been selected
		if ((e.key === "H") || (e.key === "h")) {
			if (_dialogOpen) {
				_hideDialogs();
			} else {
				_showInstructions();
			}
		}
		if ((e.ctrlKey || e.metaKey) && ((e.key === "R") || (e.key === "r"))) {
			// reset all labels
			return _resetAllLabels();
		} else if ((e.key === "R") || (e.key === "r")) {
			if (_curterm) { return _removeLabel(); }
		} else if (_curterm) {
			// show ghost term (but keep the opacity at 0)
			_g('ghost').style.display = 'inline-block';

			if ((e.key === "ArrowRight") || (e.key === "ArrowLeft") || (e.key === "a") || (e.key === "A") || (e.key === "d") || (e.key === "d")) {
				return _cycleDestinations(e);
			} else if ((e.key === "Enter") || (e.code === "Space")) {
				if (!_curMatch) {
					return _cycleDestinations(e);
				} else {
					return _mouseUpEvent(e);
				}
			}
		}
	};

	// find next label to focus
	// takes in the event.key
	const _getNextMatch = function(key) {
		// Start at current index
		let curMatchIndex;
		if (key == null) { key = "ArrowRight"; }
		let nextMatch = null;
		let nextIndex = 0;
		// get the current match's index
		if (!_curMatch) {
			curMatchIndex = -1;
		} else {
			curMatchIndex = _labels.findIndex(question => question.id === _curMatch.id);
		}
		// decide direction
		if ((key === "ArrowRight") || (key === "d") || (key === "d")) {
			// get match to the right in list
			nextIndex = (curMatchIndex + 1) % _labels.length;
		} else if ((key === "ArrowLeft") || (key === "a") || (key === "A")) {
			if (curMatchIndex > 0) {
				// get match to the left in list
				nextIndex = curMatchIndex - 1;
			} else {
				// go to end of list
				nextIndex = _labels.length - 1;
			}
		}

		nextMatch = _labels[nextIndex];

		// update aria-live region
		if (nextMatch && _labelTextsByQuestionId[nextMatch.id] && (_labelTextsByQuestionId[nextMatch.id] !== '')) {
			// same destination
			if (_curterm.getAttribute('data-placed') === nextMatch.id) {
				_assistiveAlert("Keep at destination " + (nextIndex + 1) + (nextMatch.options.description ? ". Destination description: " +  nextMatch.options.description : ""));
			// new destination, occupied
			} else {
				_assistiveAlert("Place at destination " + (nextIndex + 1) + ", occupied by label " + _labelTextsByQuestionId[nextMatch.id] + (nextMatch.options.description ? ". Destination description: " +  nextMatch.options.description : ""));
			}
		// new destination, empty
		} else {
			_assistiveAlert("Place at destination " + (nextIndex + 1) + ", empty; " + (nextMatch.options.description ? ". Destination description: " +  nextMatch.options.description : ""));
		}

		return nextMatch;
	};

	var _cycleDestinations = function(e) {
		let fadeOutCurMatch;
		const _lastID = (_curMatch != null) && (_curMatch.id != null) ? _curMatch.id : 0;
		if ((!_curMatch && (e.key === "Enter")) || (e.code === "Space")) {
			_curMatch = _getNextMatch();
		} else {
			_curMatch = _getNextMatch(e.key);
		}

		if ((_curMatch != null) && (_curMatch.id != null) && (_curMatch.id !== _lastID)) {
			const ripple = _g('ripple');
			ripple.style.transform =
			(ripple.style.msTransform =
			(ripple.style.webkitTransform = 'translate(' + (_curMatch.options.endPointX + _offsetX + _imageXMargin()) + 'px,' + (_curMatch.options.endPointY + _offsetY + _imageYMargin()) + 'px)'));
			ripple.className = '';
			ripple.className = 'play';
		}

		if (_curMatch && (_labelTextsByQuestionId[_curMatch.id] !== '')) {
			fadeOutCurMatch = true;
		}

		for (var question of Array.from(_questions)) {
			var node = _g('term_' + question.mask);
			if (fadeOutCurMatch && (node.getAttribute('data-placed') === _curMatch.id)) {
				_g('term_' + question.mask).style.opacity = 0.5;
				_curterm.style.zIndex = ++_zIndex;
			} else {
				_g('term_' + question.mask).style.opacity = 1;
			}
		}
		const termRect = _curterm.getBoundingClientRect();

		if (_curterm.className.includes("placed")) {
			return _drawBoard(termRect.right - (termRect.width / 2), termRect.top + (termRect.height / 2));
		} else {
			return _drawBoard(termRect.right - (termRect.width / 2), termRect.bottom - (termRect.height / 2));
		}
	};

	// when the widget area has a cursor or finger move
	var _mouseMoveEvent = function(e) {
		// if no term is being dragged, we don't care
		let fadeOutCurMatch, question;
		if (!_isDragging) { return; }
		if ((_curterm == null)) { return; }

		if ((e == null)) { e = window.event; }

		// if it's not a mouse move, it's probably touch
		if (!e.clientX) {
			e.clientX = e.changedTouches[0].clientX;
			e.clientY = e.changedTouches[0].clientY;
		}

		let x = (e.clientX - 30);
		if (x < 40) { x = 40; }
		if (x > window.innerWidth - 135) { x = window.innerWidth - 135; }
		let y = (e.clientY - 90);
		if (y < 0) { y = 0; }
		if (y > window.innerHeight - 90) { y = window.innerHeight - 90; }

		// move the current term
		_curterm.style.left = "-28px" // reset margin positioning
		_curterm.style.transform =
		(_curterm.style.msTransform =
		(_curterm.style.webkitTransform = 'translate(' + x + 'px,' + y + 'px)'));

		const _lastID = (_curMatch != null) && (_curMatch.id != null) ? _curMatch.id : 0;

		// check proximity against available drop points
		let minDist = Number.MAX_VALUE;
		_curMatch = null;
		let i = 0;

		// first look for ones that aren't filled, then try replacing ones with a label filling them
		// this is a two-pass process
		let onlyUnfilled = true;
		for (let pass = 1; pass <= 2; pass++) {
			for (question of Array.from(_questions)) {
				// distance formula
				var dist = Math.sqrt(Math.pow((e.clientX - question.options.endPointX - _offsetX - _imageXMargin() - 195),2) + Math.pow((e.clientY - question.options.endPointY - _offsetY - _imageYMargin() - 50),2));

				// we want the closest one
				if ((dist < minDist) && (dist < 200)) {
					if (onlyUnfilled && _labelTextsByQuestionId[question.id]) {
						continue;
					}
					minDist = dist;
					_curMatch = question;
				}
				i++;
			}
			// if we didnt find anything, accept filled ones
			if (!_curMatch) {
				onlyUnfilled = false;
			}
		}

		if ((_curMatch != null) && (_curMatch.id != null) && (_curMatch.id !== _lastID)) {
			const ripple = _g('ripple');
			ripple.style.transform =
			(ripple.style.msTransform =
			(ripple.style.webkitTransform = 'translate(' + (_curMatch.options.endPointX + _offsetX + _imageXMargin()) + 'px,' + (_curMatch.options.endPointY + _offsetY + _imageYMargin()) + 'px)'));
			ripple.className = '';
			ripple.offsetWidth = ripple.offsetWidth;
			ripple.className = 'play';
		}

		if (_curMatch && (_labelTextsByQuestionId[_curMatch.id] !== '')) {
			fadeOutCurMatch = true;
		}

		for (question of Array.from(_questions)) {
			var node = _g('term_' + question.mask);
			if (fadeOutCurMatch && (node.getAttribute('data-placed') === _curMatch.id)) {
				_g('term_' + question.mask).style.opacity = 0.5;
				_curterm.style.zIndex = ++_zIndex;
			} else {
				_g('term_' + question.mask).style.opacity = 1;
			}
		}

		_drawBoard(e.clientX, e.clientY);

		// don't scroll on iPad
		e.preventDefault();
		if (e.stopPropagation != null) { return e.stopPropagation(); }
	};

	// when we let go of a term
	var _mouseUpEvent = function(e) {
		// we don't care if nothing is selected
		let _curtermCopy, matched;
		if ((_curterm == null)) { return; }

		// apply easing (for snap back animation)
		_curterm.className = 'term ease';

		let focusNode = null;

		// the aria-live update
		let ariaUpdate = "";

		// if it's matched with a dot
		if (_curMatch != null) {
			// used after reset
			matched = true;

			const _destination = _labels.findIndex(question => question.id === _curMatch.id);

			// make copies of current match and term because we're moving them
			const _curMatchCopy = _curMatch;
			_curtermCopy = _curterm;

			// the node we'll focus after term is placed
			focusNode = (!_curterm.getAttribute('data-placed') ? _curterm.nextSibling : undefined) || document.querySelectorAll(".unplaced")[0];

			// if the label spot already has something there
			if (_labelTextsByQuestionId[_curMatch.id]) {
				// find the node and put it back in the terms list
				for (var question of Array.from(_questions)) {
					var node = _g('term_' + question.mask);
					if (node.getAttribute('data-placed') === _curMatch.id) {
						// don't replace if it's the same term
						if (node.id !== _curterm.id) {
							node.className = 'term unplaced ease';
							node.removeAttribute('data-placed');
							// term switcharoo
							var node_copy = node;
							node.remove();
							_curterm = _curterm.parentElement.replaceChild(node_copy, _curterm);
							// we'll actually focus on the new child
							focusNode = node_copy;
							ariaUpdate = "Replaced label " + question.questions[0].text + " with " + _curterm.innerText + " at destination " + (_destination + 1);
							node_copy.setAttribute('aria-label', "Now on label " + node_copy.innerText + ", currently unplaced");
							_curterm.setAttribute('aria-label', "Now on label " + _curterm.innerText + ", currently placed at Destination " + (_destination + 1));
						} else {
							ariaUpdate = "Label " + _curterm.innerText + " kept at destination " + (_destination + 1);
							matched = false;
						}
						break;
					}
				}
			} else if (!_curterm.getAttribute('data-placed')) {
				ariaUpdate = "Placed label " + _curterm.innerText + " at destination " +  (_destination + 1);
				_curterm.setAttribute('aria-label', "Now on label " + _curterm.innerText + ", currently placed at Destination " + (_destination + 1));
			} else if (_curterm.getAttribute('data-placed')) {
				ariaUpdate = "Moved label " + _curterm.innerText + " to destination " +  (_destination + 1);
				_curterm.setAttribute('aria-label', "Now on label " + _curterm.innerText + ", currently placed at Destination " + (_destination + 1));
			}

			if (matched) {
				// move term into the placed terms div
				_g('placed-terms').appendChild(_curterm);
				// reassign our variables to the copies we made earlier
				_curterm = _curtermCopy;
				_curMatch = _curMatchCopy;

				// if it has been placed before, reset the place it was placed
				if (_curterm.getAttribute('data-placed')) {
					_labelTextsByQuestionId[_curterm.getAttribute('data-placed')] = '';
				}
				// set the label key value array to this current answer
				_labelTextsByQuestionId[_curMatch.id] = _curterm.innerHTML;

				// move the label to where it belongs
				_curterm.style.webkitTransform =
				(_curterm.style.msTransform =
				(_curterm.style.transform =
					'translate(' + (_curMatch.options.labelBoxX + 205 + _offsetX) + 'px,' + ((_curMatch.options.labelBoxY + _offsetY + _imageYMargin()) - 20) + 'px)'));
				
				// workaround to allow us to scale margin
				// independently from the label's position on the canvas
				_curterm.style.left = (-28 + _imageXMargin())+"px"
				
				_curterm.className = 'term ease placed';

				// identify this element with the question it is answering
				_curterm.setAttribute('data-placed', _curMatch.id);
			}
		} else {
			// not matched with a dot, reset the place it was placed
			_labelTextsByQuestionId[_curterm.getAttribute('data-placed')] = '';
			_curterm.removeAttribute('data-placed');
			_curterm.setAttribute('aria-label', "Now on label " + _curterm.innerText + ", currently unplaced");
			_curterm.className = 'term ease unplaced';
			_curterm.style.left = "-28px"
			if (_wasPlaced) {
				_curtermCopy = _curterm;
				_curterm.remove();
				// move term into the placed terms div
				_g('unplaced-terms').appendChild(_curtermCopy);
			}
		}

		// update term headers
		const numFilled = _questions.length - document.querySelectorAll('.unplaced').length;
		if (numFilled === _questions.length) {
			_g('unplaced-header').setAttribute('aria-label', "No unplaced labels. All labels have been placed.");
			ariaUpdate = "Placed all labels. Submit your answers to see your score.";
		} else if (numFilled > 0) {
			_g('placed-header').setAttribute('aria-label', "Placed labels. There are " + numFilled + " labels placed.");
			_g('unplaced-header').setAttribute('aria-label', "Unplaced labels. There are " + (_questions.length - numFilled) + " labels remaining.");
		}

		// rearrange the terms list
		_arrangeList();

		// reset
		_curterm = null;
		_curMatch = null;
		_isDragging = false;
		_wasPlaced = false;

		// if (focusNode)
		// 	focusNode.focus()

		// play the aria live update after focusing
		_assistiveAlert(ariaUpdate);

		// render changes
		_drawBoard();

		if (matched) {
			// keep ghost on screen
			_g('ghost').style.opacity = 0.5;
		} else {
			_g('ghost').style.opacity = 0;
		}
		_g('ghost').className = 'term hide';

		// prevent iPad/etc from scrolling
		return e.preventDefault();
	};

	var _removeLabel = function() {
		if (_curterm !== null) {
			for (var question of Array.from(_questions)) {
				if (_curterm.getAttribute('data-placed') === question.id) {
					_curterm.className = 'term unplaced ease';
					_curterm.removeAttribute('data-placed');
					_curterm.setAttribute('aria-label',  "Now on label: " + question.questions[0].text + ", currently unplaced");
					_labelTextsByQuestionId[question.id] = '';
					var node_copy = _curterm;
					_curterm.remove();
					// move term into the placed terms div
					_g('unplaced-terms').appendChild(node_copy);
					break;
				}
			}
		}

		_assistiveAlert("Label removed.");

		_arrangeList();
		return _drawBoard();
	};

	// moves all terms back into the termlist
	var _resetAllLabels = function() {
		// if we're cycling through destinations, clear current match
		_curMatch = null;
		// terms, retreat!
		for (var question of Array.from(_questions)) {
			var node = _g('term_' + question.mask);
			node.className = 'term unplaced ease';
			node.removeAttribute('data-placed');
			node.setAttribute('aria-label',  "Now on label: " + question.questions[0].text + ", currently unplaced");
			_labelTextsByQuestionId[question.id] = '';
			var node_copy = node;
			node.remove();
			// move term into the placed terms div
			_g('unplaced-terms').appendChild(node_copy);
		}


		// labels, shut up!
		_labelTextsByQuestionId = {};

		// terms, resume default positions!
		_arrangeList();

		// ready to execute plan B.
		_drawBoard();

		// notify superiors
		return _assistiveAlert("All labels have been reset.");
	};


	// draw a dot on the specified canvas context
	var _drawDot = function(x,y,radius,border,context,borderColor,fillColor) {
		context.beginPath();
		context.arc(x, y, radius, 2 * Math.PI, false);
		context.fillStyle = fillColor;
		context.fill();
		context.lineWidth = border;
		context.strokeStyle = borderColor;
		return context.stroke();
	};

	// draw a stroked line (one big line, one smaller on top)
	var _drawStrokedLine = function(x1,y1,x2,y2,color1,color2,context) {
		if (context == null) { context = _context; }
		Labeling.Draw.drawLine(context, x1 + _offsetX, y1 + _offsetY, x2 + _offsetX, y2 + _offsetY, 6, color1);
		return Labeling.Draw.drawLine(context, x1 + _offsetX, y1 + _offsetY, x2 + _offsetX, y2 + _offsetY, 2, color2);
	};

	// render the canvas frame
	var _drawBoard = function(mouseX,mouseY) {
		// clear any lines outside of the canvas
		if (mouseX == null) { mouseX = 0; }
		if (mouseY == null) { mouseY = 0; }
		_context.clearRect(0,0,1000,1000);

		// draw the asset image
		// only use shadow if its not graph paper, because
		// that would look bad
		if (_qset.options.backgroundTheme !== 'themeGraphPaper') {
			_context.shadowOffsetX = 0;
			_context.shadowOffsetY = 0;
			_context.shadowBlur = 10;
			_context.shadowColor = 'rgba(0,0,0,0.5)';
		}

		_context.drawImage(_img, _qset.options.imageX,_qset.options.imageY,(_img.width * _qset.options.imageScale), (_img.height * _qset.options.imageScale));
		_context.shadowColor = '';
		_context.shadowBlur = 0;

		// reference the ghost object, and make it invisible
		const ghost = _g('ghost');
		ghost.style.opacity = 0;

		return (() => {
			const result = [];
			for (var question of Array.from(_questions)) {
			// if the question has an answer placed, draw a solid line connecting it
			// but only if the label is not replacing one that already exists
				var dotBackground, dotBorder;
				if (_labelTextsByQuestionId[question.id] && !(_curMatch && _labelTextsByQuestionId[_curMatch.id] && (question.id === _curMatch.id))) {
					_drawStrokedLine(question.options.endPointX, question.options.endPointY, question.options.labelBoxX, question.options.labelBoxY, '#fff', '#000');
					dotBorder = 'rgba(255,255,255,' + _anchorOpacityValue + ')';
					dotBackground = 'rgba(0,0,0,' + _anchorOpacityValue + ')';
				} else {
					dotBorder = 'rgba(0,0,0,' + _anchorOpacityValue + ')';
					dotBackground = 'rgba(255,255,255,' + _anchorOpacityValue + ')';
				}

				// if the question has a match dragged near it, draw a ghost line
				if ((_curMatch != null) && (_curMatch.id === question.id)) {
					_drawStrokedLine(question.options.endPointX, question.options.endPointY, question.options.labelBoxX, question.options.labelBoxY, 'rgba(255,255,255,0.2)', 'rgba(0,0,0,0.3)');

					dotBorder = 'rgba(255,255,255,' + _anchorOpacityValue + ')';
					dotBackground = 'rgba(0,0,0,' + _anchorOpacityValue + ')';

					// if the match doesn't have a label already
					if (!_labelTextsByQuestionId[_curMatch.id]) {
						// move the ghost label and make it semi-transparent
						ghost.style.webkitTransform =
						(ghost.style.msTransform =
						(ghost.style.transform = 'translate(' + (question.options.labelBoxX + 205 + _offsetX + _imageXMargin()) + 'px,' + (question.options.labelBoxY + _offsetY + _imageYMargin() + 35) + 'px)'));
						ghost.style.opacity = 0.5;
						_g('ghost').className = 'term';
					}
				} else if (!_curMatch) {
					_g('term_' + question.mask).style.opacity = 1;
				}

				result.push(_drawDot(question.options.endPointX + _offsetX,question.options.endPointY + _offsetY, 9, 3, _context, dotBorder, dotBackground));
			}
			return result;
		})();
	};

	// show the "are you done?" warning dialog
	const _showAlert = function() {
		_prevFocus = document.activeElement;
		_g('game').setAttribute("aria-hidden", true);
		_g('game').setAttribute("inert", true);
		_g('alertbox').removeAttribute("inert");
		_g('alertbox').setAttribute("aria-hidden", false);
		_g('alertbox').classList.add('show');
		_g('backgroundcover').classList.add('show');
		_g('confirmbtn').removeEventListener('click', _submitButtonConfirm);
		_g('confirmbtn').addEventListener('click', _submitButtonConfirm);
		_g('cancelbtn').focus();
		return _dialogOpen = true;
	};

	var _submitButtonConfirm = function() {
		_hideDialogs();
		return _submitAnswersToMateria();
	};

	// hide all  dialogs
	var _hideDialogs = function() {
		_g('alertbox').classList.remove('show');
		_g('backgroundcover').classList.remove('show');
		_g('previewbox').classList.remove('show');
		_g('alertbox').setAttribute("inert", true);
		_g('alertbox').setAttribute("aria-hidden", true);
		_g('backgroundcover').setAttribute("inert", true);
		_g('previewbox').setAttribute("inert", true);
		_g('previewbox').setAttribute("aria-hidden", true);
		_g('game').setAttribute("aria-hidden", false);
		_g('game').removeAttribute("inert");

		_dialogOpen = false;

		if (_prevFocus) {
			return _prevFocus.focus();
		} else {
			return _g('instructionsBtn').focus();
		}
	};

	var _showInstructions = function() {
		_prevFocus = document.activeElement;
		_g('previewbox').classList.add('show');
		_g('previewbox').removeAttribute("inert");
		_g('previewbox').setAttribute("aria-hidden", false);
		_g('gotitbtn').focus();
		_g('game').setAttribute("aria-hidden", true);
		_g('game').setAttribute("inert", true);
		return _dialogOpen = true;
	};

	var _assistiveAlert = msg => _g('assistive-alert').innerHTML = msg;

	// submit questions to Materia. Ask first if they aren't done$
	var _submitAnswers = function() {
		if (!_isPuzzleComplete) {
			return _showAlert();
		} else {
			return _submitAnswersToMateria();
		}
	};

	// submit every question and the placed answer to Materia for scoring
	var _submitAnswersToMateria = function() {
		for (var question of Array.from(_questions)) {
			Materia.Score.submitQuestionForScoring(question.id, _labelTextsByQuestionId[question.id]);
		}
		return Materia.Engine.end();
	};

	//public
	return {
		manualResize: true,
		start
	};
})();
