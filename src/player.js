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
	let _svg = null;
	let _defs = null;

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
	let _finals = [] // destination terms
	let _unplaced = [] // source terms

	// current selection via touch/key navigation
	let _curFocus = null;
	let _curSelectSource = null;
	let _curSelectTarget = null;
	let _curSelTarIndex = 0; // used to traverse finals list

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

	// mobile breakpoint pxs
	const _mobilePx = 840
	
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

		background = "#294A42"

		// set background and header title
		_g('board').style.background = background;
		if ((instance.name === undefined) || null) {
			instance.name = "Widget Title Goes Here";
		}
		_g('title').innerHTML = instance.name;
		_g('title').style['font-size'] = ((20 - (instance.name.length / 30)) + 'px');
		_g('instructions-header').setAttribute('aria-label',  "Welcome to " + instance.name + ", a labeling game! How to play: ");

		_g('checkBtn').addEventListener('click', () => _submitAnswers());
		_g('cancelbtn').addEventListener('click', _hideDialogs);
		_g('backgroundcover').addEventListener('click', _hideDialogs);
		_g('instructionsBtn').addEventListener('click', _showInstructions);
		document.getElementById("reset").addEventListener("click", (e) => _resetAllLabels())
		document.addEventListener('keydown', _keyboardEvent);

		_g('backgroundcover').classList.add('show');
		_g('gotitbtn').addEventListener('click', _hideDialogs);
		
		document.getElementById("board").addEventListener("dragover", (e)=>e.preventDefault())
		document.getElementById("unplaced-terms").addEventListener("dragover", (e)=>e.preventDefault())

		_svg = document.getElementById("svglayer")
		_defs = document.getElementById("defs")
		// load the image asset
		// when done, render the board
		_img = document.getElementById("imgsrc")
		// _img.onload = _drawBoard;

		_img.src = Materia.Engine.getImageAssetUrl((
			_qset.options.image ? _qset.options.image.id : _qset.assets[0]));
		_img.alt = _qset.options.image && _qset.options.image.alt ? _qset.options.image.alt : "No description provided. Please contact author of this widget for an image description.";
		// _canvas.setAttribute('aria-label', _qset.options.image && _qset.options.image.alt ? _qset.options.image.alt : "No description provided. Please contact author of this widget for an image description.");
		
		// store sidebar terms to be added later
		let addTerms = []
	
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
			term.addEventListener('focus', _termFocus);
			term.addEventListener('blur', _termBlur);
			term.addEventListener("keydown", _termKeyHandler)
			term.addEventListener("mouseup", _mouseUpEvent)
			term.addEventListener("dragstart", (e) => {
				_isDragging = true
				setTimeout(()=>e.target.classList.add("empty"), 10)
			})
			term.addEventListener("drag", _dragWhileHandler)
			term.addEventListener("dragend", _dragEndHandler)
			term.setAttribute('draggable', true)
			term.setAttribute("tabindex", 0);

			var fontSize = (15 - (question.questions[0].text.length / 10));
			if (fontSize < 12) { fontSize = 12; }
			term.style.fontSize = fontSize + 'px';

			addTerms.push(term)

			// Some legacy qsets store these as strings, which we certainly don't want
			question.options.endPointX = parseInt(question.options.endPointX);
			question.options.endPointY = parseInt(question.options.endPointY);
			question.options.labelBoxX = parseInt(question.options.labelBoxX);
			question.options.labelBoxY = parseInt(question.options.labelBoxY);

			let ghost = document.createElement('div');
			ghost.id = "ghost_"+question.mask
			ghost.className = 'term final ghost'
			ghost.style.left = question.options.labelBoxX+"px"
			ghost.style.top = question.options.labelBoxY+"px"
			ghost.setAttribute("data-q_id", question.id)
			ghost.setAttribute('draggable', false)
			ghost.addEventListener("dragstart", (e) => {
				_isDragging = true
				// setTimeout(()=>e.target.classList.add("empty"), 10)
			})
			ghost.addEventListener("drag", _dragWhileHandler)
			ghost.addEventListener("dragend", _dragEndHandler)
			ghost.addEventListener("mouseup", _mouseUpEvent)
			ghost.addEventListener("keydown", _termKeyHandler)
			ghost.addEventListener('focus', (e) => _termFocus);
			ghost.addEventListener('blur', (e) => _termBlur);

			document.getElementById('image').appendChild(ghost)

			let x1 = question.options.endPointX
			let y1 = question.options.endPointY
			let x2 = question.options.labelBoxX + 95
			let y2 = question.options.labelBoxY + 15

			let dist = _distance(x1, y1, x2, y2)

			let grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient")
			grad.id = "grad_"+question.mask
			grad.setAttribute("x1", x1 < x2 ? 0 : Math.abs(x1-x2)/dist)
			grad.setAttribute("y1", y1 < y2 ? 0 : Math.abs(y1-y2)/dist)
			grad.setAttribute("x2", x2 < x1 ? 0 : Math.abs(x1-x2)/dist)
			grad.setAttribute("y2", y2 < y1 ? 0 : Math.abs(y1-y2)/dist)
			grad.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink")
			grad.setAttribute("href", "#core-gradient")

			_defs.appendChild(grad)

			let line = document.createElementNS("http://www.w3.org/2000/svg", "line")
			line.id = "line_"+question.mask
			line.setAttribute("x1", x1)
			line.setAttribute("y1", y1 - 8)
			line.setAttribute("x2", x2)
			line.setAttribute("y2", y2)
			line.setAttribute("stroke", `url(#${grad.id})`)

			_svg.appendChild(line)

			
			let bullet = document.createElementNS("http://www.w3.org/2000/svg", "circle")
			bullet.id = "bullet_"+question.mask
			bullet.classList.add("bullet")
			bullet.setAttribute("cx", x1)
			bullet.setAttribute("cy", y1 - 8)
			bullet.setAttribute("r", 8)

			_svg.appendChild(bullet)

			let core = document.createElementNS("http://www.w3.org/2000/svg", "circle")
			core.id = "core_"+question.mask
			core.classList.add("core")
			core.style.display = "none"
			core.setAttribute("cx", x1)
			core.setAttribute("cy", y1 - 8)
			core.setAttribute("r", 5)

			_svg.appendChild(core)
		}

		// shuffle these separately
		addTerms = _shuffle(addTerms)
		addTerms.forEach((v)=>_g('unplaced-cont').appendChild(v))

		_finals = Array.from(document.getElementsByClassName("final"))
		_unplaced = Array.from(document.getElementsByClassName("unplaced"))
	};

	// https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
	const _shuffle = function(array) {
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

	const _distance = (x1, y1, x2, y2) => {
		return Math.sqrt(((x1-x2)**2) + ((y1-y2)**2))
	}

	const _dragWhileHandler = (e) => {
		let minDist = 200
		let found = null

		_finals.forEach((v)=>{
			const rect = v.getBoundingClientRect()
			const dist = _distance(e.clientX, e.clientY, rect.left + 95, rect.top + 15)
			
			if(dist < minDist) {
				found = v
				minDist = dist
			}
		})

		if(_curMatch) {
			_curMatch.classList.remove("target")
			document.getElementById(_curMatch.id.replace("ghost", "line")).classList.remove("target")
			_curMatch = null
		}

		if(found) {
			found.classList.add("target")
			document.getElementById(found.id.replace("ghost", "line")).classList.add("target")
			_curMatch = found
		}

	}

	const _termFocus = (e) => {
		_curFocus = e.target
	}

	const _termBlur = (e) => {
		_curFocus = null
	}

	const _termKeyHandler = (e) => {
		switch (e.key) {
			case "Enter":
				if (_curSelectSource != e.target) {
					_keySelectSource(e.target)
					_keySelectTarget(_finals[_curSelTarIndex])
				} else {
					_placeIntoGhost(e.target, _finals[_curSelTarIndex])
					_keyDeselectCurTarget()
					_keyDeselectCurSource()
				}

				break;
			case "Tab":
				_keyDeselectCurSource()
				_keyDeselectCurTarget()

				_finals.forEach((v)=>{
					v.classList.remove("target")
					document.getElementById(v.id.replace("ghost", "line")).classList.remove("target")
				})
				break;
			default:
				break;
		}
	}

	// s: source
	// selects the source for use with touch/key controls
	const _keySelectSource = (s) => {
		_unplaced.forEach((u)=>{
			if(!u.className.includes("empty")) {
				u.classList.add("target")
				u.setAttribute("draggable", false)
			}
		})

		_curSelectSource = s
		_curSelectSource.classList.remove("target")
		_curSelectSource.classList.add("clickfocus")
	}

	const _keyDeselectCurSource = () => {
		if (!_curSelectSource) return

		_unplaced.forEach((u)=>{
			u.classList.remove("target")
			if(!u.className.includes("empty")) {
				u.setAttribute("draggable", true)
			}
		})

		_curSelectSource.classList.remove("clickfocus")
		_curSelectSource.blur()
		_curSelectSource = null
	}

	// t: target
	// selects the target for use with touch/key controls
	const _keySelectTarget = (t) => {
		_keyDeselectCurTarget()

		_curSelectTarget = t
		_curSelectTarget.classList.add("target")
		document.getElementById(_curSelectTarget.id.replace("ghost", "line")).classList.add("target")
	}

	const _keyDeselectCurTarget = () => {
		if (!_curSelectTarget) return

		_curSelectTarget.classList.remove("target")
		document.getElementById(_curSelectTarget.id.replace("ghost", "line")).classList.remove("target")
		_curSelectTarget = null
	}

	// v: unplaced term
	const _resetUnplaced = (v) => {
		v.classList.remove("empty")
		v.setAttribute("draggable", true)
		v.setAttribute("tabindex", 0)
	}

	// v: ghost term
	const _resetGhost = (v, delay) => {
		const labelId = v.getAttribute("data-label_id")
		if (labelId) {
			// reset svg graphics for label being placed
			document.getElementById(v.id.replace("ghost","core")).style.display = "none"
			document.getElementById(v.id.replace("ghost", "line")).classList.remove("placed")

			// reset state of ghost label itself
			v.classList.remove("placed")
			v.classList.add("ghost")
			v.setAttribute("draggable", false)
			v.setAttribute("tabindex", -1)

			// reset data inside label
			v.innerHTML = ""
			v.setAttribute("data-label_id", "")

			// reset scoring attached to label
			_labelTextsByQuestionId[v.getAttribute("data-q_id")] = ""

			_checkIfComplete()

			// reset source label
			if(!delay)
				_resetUnplaced(document.getElementById(labelId))
			else
				setTimeout(()=>_resetUnplaced(document.getElementById(labelId)), delay ?? 0)
		}
	}

	// s: source term
	// v: ghost/target term
	const _placeIntoGhost = (s, v) => {
		let data = s.innerHTML
		let sourceId = s.id

		// if the target ghost already contains data from a label, reset it
		if(v.getAttribute("data-label_id")) {
			_animateResetGhost(v)
		}

		// handle if data is coming from unplaced label or other final label
		if(s.className.includes("final")) {
			// save data and reset source ghost
			sourceId = s.getAttribute("data-label_id")
			_resetGhost(s)
		}
		// hide source unplaced label
		document.getElementById(sourceId).classList.add("empty")
		document.getElementById(sourceId).setAttribute("draggable", false)
		document.getElementById(sourceId).setAttribute("tabindex", -1)

		// set data of ghost 
		v.innerHTML = data
		_labelTextsByQuestionId[v.getAttribute("data-q_id")] = data

		// set ghost state
		v.classList.remove("ghost")
		v.classList.add("placed")
		v.setAttribute("draggable", true)
		v.setAttribute("data-label_id", sourceId)
		v.setAttribute("tabindex", 0)

		// set svg graphic state
		document.getElementById(v.id.replace("ghost","core")).style.display = "block"
		document.getElementById(v.id.replace("ghost","line")).classList.add("placed")

		_checkIfComplete()
	}
	
	const _dragEndHandler = (e) => {
		_isDragging = false

		if(_curMatch)
		{
			e.preventDefault()
			
			// remove targeting effects
			_curMatch.classList.remove("target")
			document.getElementById(_curMatch.id.replace("ghost", "line")).classList.remove("target")

			// do nothing if you're dragging a label onto itself
			if(_curMatch.innerHTML == e.target.innerHTML) return

			// perform the place
			_placeIntoGhost(e.target, _curMatch)

			_curMatch = null
		} else {
			if(e.target.className.includes("final")) {
				_resetGhost(e.target)
			} else {
				_resetUnplaced(e.target)
			}
		}
	}

	const _keyboardEvent = function(e) {
		if (_curFocus) {
			if (e.key === "R" || e.key === "r") {
				if(_curFocus.className.includes("final")) {
					_animateResetGhost(_curFocus)
				}
			}
		}
		if (_curSelectSource) {
			if(e.key === "ArrowLeft" || e.key === "ArrowRight") {
				if(e.key === "ArrowLeft")
					_curSelTarIndex = _curSelTarIndex - 1 < 0 ? _finals.length - 1 : _curSelTarIndex - 1
				else if(e.key === "ArrowRight")
					_curSelTarIndex = _curSelTarIndex + 1 >= _finals.length ? 0 : _curSelTarIndex + 1

				_keySelectTarget(_finals[_curSelTarIndex])
			}
		}		
		if ((e.key === "H") || (e.key === "h")) {
			if (_dialogOpen) {
				_hideDialogs();
			} else {
				_showInstructions();
			}
		}
		if(e.ctrlKey && (e.key === "R" || e.key === "r")) {
			_resetAllLabels()
		}
	};

	const _resetAllLabels = () => {
		// tracks number of labels to reset for anim
		let count = 0

		_finals.forEach((v)=>{
			v.classList.remove("target")
			document.getElementById(v.id.replace("ghost", "line")).classList.remove("target")

			if (window.innerWidth < _mobilePx) {
				_resetGhost(v)
			} else if(v.className.includes("placed")) {
				// offsets each reset by 50ms
				setTimeout(()=>requestAnimationFrame(()=>_animateResetGhost(v)), count*75)
				count++
			}
		})
	}

	// this will handle non drag events
	const _mouseUpEvent = (e) => {
		if(_isDragging) return
		
		const v = e.target

		if(!_curSelectSource) {
			if(v.className.includes("empty")) return

			if(v.className.includes("final")) {
				_animateResetGhost(v)
			} else {
				
				_keySelectSource(v)

				_finals.forEach((f)=>{
					f.classList.add("target")
					document.getElementById(f.id.replace("ghost", "line")).classList.add("target")
				})
			}
		} else {
			if(v == _curSelectSource) {
				_keyDeselectCurSource()

				_finals.forEach((f)=>{
					f.classList.remove("target")
					document.getElementById(f.id.replace("ghost", "line")).classList.remove("target")
				})
			} else if(v.className.includes("final")) {
				_placeIntoGhost(_curSelectSource, v)
				_keyDeselectCurSource()

				_finals.forEach((f)=>{
					f.classList.remove("target")
					document.getElementById(f.id.replace("ghost", "line")).classList.remove("target")
				})
			}
		}
	}

	const _checkIfComplete = () => {
		let flag = true

		_finals.forEach((v) => {
			if(v.className.includes("ghost")) flag = false;
		})
		
		_isPuzzleComplete = flag;
		if(_isPuzzleComplete)
			document.getElementById("empty-notice").classList.add("visible")
		else
			document.getElementById("empty-notice").classList.remove("visible")
		
	}

	// v: ghost term
	// this is a wrapper for reset ghost that performs a return animation
	const _animateResetGhost = (v) => {
		const labelId = v.getAttribute("data-label_id")
		if (labelId) {
			const game = document.getElementById("game")
			const posS = v.getBoundingClientRect()
			const posT = document.getElementById(labelId).getBoundingClientRect()

			// disable animations on mobile
			const delay = window.innerWidth < _mobilePx ? 0 : 600

			let anim = document.createElement("div")
			anim.className = "term animated"
			anim.innerHTML = v.innerHTML

			// starting position
			anim.style.transform = `translate(${posS.left}px, ${posS.top}px)`
			anim.addEventListener("transitionend", (e)=>{
				if(e.propertyName == "opacity")
					e.target.remove()
				else if(e.propertyName == "transform")
					e.target.style.opacity = 1
			})
			
			game.appendChild(anim)

			// ending position
			setTimeout(()=>anim.style.transform = `translate(${posT.left}px, ${posT.top}px)`, 0)
			_resetGhost(v, delay) // this should match sum length of transitions in css
		}	
	}

	// // find next label to focus
	// // takes in the event.key
	// const _getNextMatch = function(key) {
	// 	// Start at current index
	// 	let curMatchIndex;
	// 	if (key == null) { key = "ArrowRight"; }
	// 	let nextMatch = null;
	// 	let nextIndex = 0;
	// 	// get the current match's index
	// 	if (!_curMatch) {
	// 		curMatchIndex = -1;
	// 	} else {
	// 		curMatchIndex = _labels.findIndex(question => question.id === _curMatch.id);
	// 	}
	// 	// decide direction
	// 	if ((key === "ArrowRight") || (key === "d") || (key === "d")) {
	// 		// get match to the right in list
	// 		nextIndex = (curMatchIndex + 1) % _labels.length;
	// 	} else if ((key === "ArrowLeft") || (key === "a") || (key === "A")) {
	// 		if (curMatchIndex > 0) {
	// 			// get match to the left in list
	// 			nextIndex = curMatchIndex - 1;
	// 		} else {
	// 			// go to end of list
	// 			nextIndex = _labels.length - 1;
	// 		}
	// 	}

	// 	nextMatch = _labels[nextIndex];

	// 	// update aria-live region
	// 	if (nextMatch && _labelTextsByQuestionId[nextMatch.id] && (_labelTextsByQuestionId[nextMatch.id] !== '')) {
	// 		// same destination
	// 		if (_curterm.getAttribute('data-placed') === nextMatch.id) {
	// 			_assistiveAlert("Keep at destination " + (nextIndex + 1) + (nextMatch.options.description ? ". Destination description: " +  nextMatch.options.description : ""));
	// 		// new destination, occupied
	// 		} else {
	// 			_assistiveAlert("Place at destination " + (nextIndex + 1) + ", occupied by label " + _labelTextsByQuestionId[nextMatch.id] + (nextMatch.options.description ? ". Destination description: " +  nextMatch.options.description : ""));
	// 		}
	// 	// new destination, empty
	// 	} else {
	// 		_assistiveAlert("Place at destination " + (nextIndex + 1) + ", empty; " + (nextMatch.options.description ? ". Destination description: " +  nextMatch.options.description : ""));
	// 	}

	// 	return nextMatch;
	// };

	// var _cycleDestinations = function(e) {
	// 	let fadeOutCurMatch;
	// 	const _lastID = (_curMatch != null) && (_curMatch.id != null) ? _curMatch.id : 0;
	// 	if ((!_curMatch && (e.key === "Enter")) || (e.code === "Space")) {
	// 		_curMatch = _getNextMatch();
	// 	} else {
	// 		_curMatch = _getNextMatch(e.key);
	// 	}

	// 	if ((_curMatch != null) && (_curMatch.id != null) && (_curMatch.id !== _lastID)) {
	// 		const ripple = _g('ripple');
	// 		ripple.style.transform =
	// 		(ripple.style.msTransform =
	// 		(ripple.style.webkitTransform = 'translate(' + (_curMatch.options.endPointX + _offsetX + _imageXMargin()) + 'px,' + (_curMatch.options.endPointY + _offsetY + _imageYMargin()) + 'px)'));
	// 		ripple.className = '';
	// 		ripple.className = 'play';
	// 	}

	// 	if (_curMatch && (_labelTextsByQuestionId[_curMatch.id] !== '')) {
	// 		fadeOutCurMatch = true;
	// 	}

	// 	for (var question of Array.from(_questions)) {
	// 		var node = _g('term_' + question.mask);
	// 		if (fadeOutCurMatch && (node.getAttribute('data-placed') === _curMatch.id)) {
	// 			_g('term_' + question.mask).style.opacity = 0.5;
	// 			_curterm.style.zIndex = ++_zIndex;
	// 		} else {
	// 			_g('term_' + question.mask).style.opacity = 1;
	// 		}
	// 	}
	// 	const termRect = _curterm.getBoundingClientRect();

	// 	if (_curterm.className.includes("placed")) {
	// 		return _drawBoard(termRect.right - (termRect.width / 2), termRect.top + (termRect.height / 2));
	// 	} else {
	// 		return _drawBoard(termRect.right - (termRect.width / 2), termRect.bottom - (termRect.height / 2));
	// 	}
	// };

	// // when the widget area has a cursor or finger move
	// var _mouseMoveEvent = function(e) {
	// 	// if no term is being dragged, we don't care
	// 	let fadeOutCurMatch, question;
	// 	if (!_isDragging) { return; }
	// 	if ((_curterm == null)) { return; }

	// 	if ((e == null)) { e = window.event; }

	// 	// if it's not a mouse move, it's probably touch
	// 	if (!e.clientX) {
	// 		e.clientX = e.changedTouches[0].clientX;
	// 		e.clientY = e.changedTouches[0].clientY;
	// 	}

	// 	let x = (e.clientX - 30);
	// 	if (x < 40) { x = 40; }
	// 	if (x > window.innerWidth - 135) { x = window.innerWidth - 135; }
	// 	let y = (e.clientY - 90);
	// 	if (y < 0) { y = 0; }
	// 	if (y > window.innerHeight - 90) { y = window.innerHeight - 90; }

	// 	// move the current term
	// 	_curterm.style.left = "-28px" // reset margin positioning
	// 	_curterm.style.transform =
	// 	(_curterm.style.msTransform =
	// 	(_curterm.style.webkitTransform = 'translate(' + x + 'px,' + y + 'px)'));

	// 	const _lastID = (_curMatch != null) && (_curMatch.id != null) ? _curMatch.id : 0;

	// 	// check proximity against available drop points
	// 	let minDist = Number.MAX_VALUE;
	// 	_curMatch = null;
	// 	let i = 0;

	// 	// first look for ones that aren't filled, then try replacing ones with a label filling them
	// 	// this is a two-pass process
	// 	let onlyUnfilled = true;
	// 	for (let pass = 1; pass <= 2; pass++) {
	// 		for (question of Array.from(_questions)) {
	// 			// distance formula
	// 			var dist = Math.sqrt(Math.pow((e.clientX - question.options.endPointX - _offsetX - _imageXMargin() - 195),2) + Math.pow((e.clientY - question.options.endPointY - _offsetY - _imageYMargin() - 50),2));

	// 			// we want the closest one
	// 			if ((dist < minDist) && (dist < 200)) {
	// 				if (onlyUnfilled && _labelTextsByQuestionId[question.id]) {
	// 					continue;
	// 				}
	// 				minDist = dist;
	// 				_curMatch = question;
	// 			}
	// 			i++;
	// 		}
	// 		// if we didnt find anything, accept filled ones
	// 		if (!_curMatch) {
	// 			onlyUnfilled = false;
	// 		}
	// 	}

	// 	if ((_curMatch != null) && (_curMatch.id != null) && (_curMatch.id !== _lastID)) {
	// 		const ripple = _g('ripple');
	// 		ripple.style.transform =
	// 		(ripple.style.msTransform =
	// 		(ripple.style.webkitTransform = 'translate(' + (_curMatch.options.endPointX + _offsetX + _imageXMargin()) + 'px,' + (_curMatch.options.endPointY + _offsetY + _imageYMargin()) + 'px)'));
	// 		ripple.className = '';
	// 		ripple.offsetWidth = ripple.offsetWidth;
	// 		ripple.className = 'play';
	// 	}

	// 	if (_curMatch && (_labelTextsByQuestionId[_curMatch.id] !== '')) {
	// 		fadeOutCurMatch = true;
	// 	}

	// 	for (question of Array.from(_questions)) {
	// 		var node = _g('term_' + question.mask);
	// 		if (fadeOutCurMatch && (node.getAttribute('data-placed') === _curMatch.id)) {
	// 			_g('term_' + question.mask).style.opacity = 0.5;
	// 			_curterm.style.zIndex = ++_zIndex;
	// 		} else {
	// 			_g('term_' + question.mask).style.opacity = 1;
	// 		}
	// 	}

	// 	_drawBoard(e.clientX, e.clientY);

	// 	// don't scroll on iPad
	// 	e.preventDefault();
	// 	if (e.stopPropagation != null) { return e.stopPropagation(); }
	// };

	// // when we let go of a term
	// var _mouseUpEvent = function(e) {
	// 	// we don't care if nothing is selected
	// 	let _curtermCopy, matched;
	// 	if ((_curterm == null)) { return; }

	// 	// apply easing (for snap back animation)
	// 	_curterm.className = 'term ease';

	// 	let focusNode = null;

	// 	// the aria-live update
	// 	let ariaUpdate = "";

	// 	// if it's matched with a dot
	// 	if (_curMatch != null) {
	// 		// used after reset
	// 		matched = true;

	// 		const _destination = _labels.findIndex(question => question.id === _curMatch.id);

	// 		// make copies of current match and term because we're moving them
	// 		const _curMatchCopy = _curMatch;
	// 		_curtermCopy = _curterm;

	// 		// the node we'll focus after term is placed
	// 		focusNode = (!_curterm.getAttribute('data-placed') ? _curterm.nextSibling : undefined) || document.querySelectorAll(".unplaced")[0];

	// 		// if the label spot already has something there
	// 		if (_labelTextsByQuestionId[_curMatch.id]) {
	// 			// find the node and put it back in the terms list
	// 			for (var question of Array.from(_questions)) {
	// 				var node = _g('term_' + question.mask);
	// 				if (node.getAttribute('data-placed') === _curMatch.id) {
	// 					// don't replace if it's the same term
	// 					if (node.id !== _curterm.id) {
	// 						node.className = 'term unplaced ease';
	// 						node.removeAttribute('data-placed');
	// 						// term switcharoo
	// 						var node_copy = node;
	// 						node.remove();
	// 						_curterm = _curterm.parentElement.replaceChild(node_copy, _curterm);
	// 						// we'll actually focus on the new child
	// 						focusNode = node_copy;
	// 						ariaUpdate = "Replaced label " + question.questions[0].text + " with " + _curterm.innerText + " at destination " + (_destination + 1);
	// 						node_copy.setAttribute('aria-label', "Now on label " + node_copy.innerText + ", currently unplaced");
	// 						_curterm.setAttribute('aria-label', "Now on label " + _curterm.innerText + ", currently placed at Destination " + (_destination + 1));
	// 					} else {
	// 						ariaUpdate = "Label " + _curterm.innerText + " kept at destination " + (_destination + 1);
	// 						matched = false;
	// 					}
	// 					break;
	// 				}
	// 			}
	// 		} else if (!_curterm.getAttribute('data-placed')) {
	// 			ariaUpdate = "Placed label " + _curterm.innerText + " at destination " +  (_destination + 1);
	// 			_curterm.setAttribute('aria-label', "Now on label " + _curterm.innerText + ", currently placed at Destination " + (_destination + 1));
	// 		} else if (_curterm.getAttribute('data-placed')) {
	// 			ariaUpdate = "Moved label " + _curterm.innerText + " to destination " +  (_destination + 1);
	// 			_curterm.setAttribute('aria-label', "Now on label " + _curterm.innerText + ", currently placed at Destination " + (_destination + 1));
	// 		}

	// 		if (matched) {
	// 			// move term into the placed terms div
	// 			_g('placed-terms').appendChild(_curterm);
	// 			// reassign our variables to the copies we made earlier
	// 			_curterm = _curtermCopy;
	// 			_curMatch = _curMatchCopy;

	// 			// if it has been placed before, reset the place it was placed
	// 			if (_curterm.getAttribute('data-placed')) {
	// 				_labelTextsByQuestionId[_curterm.getAttribute('data-placed')] = '';
	// 			}
	// 			// set the label key value array to this current answer
	// 			_labelTextsByQuestionId[_curMatch.id] = _curterm.innerHTML;

	// 			// move the label to where it belongs
	// 			_curterm.style.webkitTransform =
	// 			(_curterm.style.msTransform =
	// 			(_curterm.style.transform =
	// 				'translate(' + (_curMatch.options.labelBoxX + 205 + _offsetX) + 'px,' + ((_curMatch.options.labelBoxY + _offsetY + _imageYMargin()) - 20) + 'px)'));
				
	// 			// workaround to allow us to scale margin
	// 			// independently from the label's position on the canvas
	// 			_curterm.style.left = (-28 + _imageXMargin())+"px"
				
	// 			_curterm.className = 'term ease placed';

	// 			// identify this element with the question it is answering
	// 			_curterm.setAttribute('data-placed', _curMatch.id);
	// 		}
	// 	} else {
	// 		// not matched with a dot, reset the place it was placed
	// 		_labelTextsByQuestionId[_curterm.getAttribute('data-placed')] = '';
	// 		_curterm.removeAttribute('data-placed');
	// 		_curterm.setAttribute('aria-label', "Now on label " + _curterm.innerText + ", currently unplaced");
	// 		_curterm.className = 'term ease unplaced';
	// 		_curterm.style.left = "-28px"
	// 		if (_wasPlaced) {
	// 			_curtermCopy = _curterm;
	// 			_curterm.remove();
	// 			// move term into the placed terms div
	// 			_g('unplaced-terms').appendChild(_curtermCopy);
	// 		}
	// 	}

	// 	// update term headers
	// 	const numFilled = _questions.length - document.querySelectorAll('.unplaced').length;
	// 	if (numFilled === _questions.length) {
	// 		_g('unplaced-header').setAttribute('aria-label', "No unplaced labels. All labels have been placed.");
	// 		ariaUpdate = "Placed all labels. Submit your answers to see your score.";
	// 	} else if (numFilled > 0) {
	// 		_g('placed-header').setAttribute('aria-label', "Placed labels. There are " + numFilled + " labels placed.");
	// 		_g('unplaced-header').setAttribute('aria-label', "Unplaced labels. There are " + (_questions.length - numFilled) + " labels remaining.");
	// 	}

	// 	// rearrange the terms list
	// 	_arrangeList();

	// 	// reset
	// 	_curterm = null;
	// 	_curMatch = null;
	// 	_isDragging = false;
	// 	_wasPlaced = false;

	// 	// if (focusNode)
	// 	// 	focusNode.focus()

	// 	// play the aria live update after focusing
	// 	_assistiveAlert(ariaUpdate);

	// 	// render changes
	// 	_drawBoard();

	// 	if (matched) {
	// 		// keep ghost on screen
	// 		_g('ghost').style.opacity = 0.5;
	// 	} else {
	// 		_g('ghost').style.opacity = 0;
	// 	}
	// 	_g('ghost').className = 'term hide';

	// 	// prevent iPad/etc from scrolling
	// 	return e.preventDefault();
	// };

	// var _removeLabel = function() {
	// 	if (_curterm !== null) {
	// 		for (var question of Array.from(_questions)) {
	// 			if (_curterm.getAttribute('data-placed') === question.id) {
	// 				_curterm.className = 'term unplaced ease';
	// 				_curterm.removeAttribute('data-placed');
	// 				_curterm.setAttribute('aria-label',  "Now on label: " + question.questions[0].text + ", currently unplaced");
	// 				_labelTextsByQuestionId[question.id] = '';
	// 				var node_copy = _curterm;
	// 				_curterm.remove();
	// 				// move term into the placed terms div
	// 				_g('unplaced-terms').appendChild(node_copy);
	// 				break;
	// 			}
	// 		}
	// 	}

	// 	_assistiveAlert("Label removed.");

	// 	_arrangeList();
	// 	return _drawBoard();
	// };

	// // moves all terms back into the termlist
	// var _resetAllLabels = function() {
	// 	// if we're cycling through destinations, clear current match
	// 	_curMatch = null;
	// 	// terms, retreat!
	// 	for (var question of Array.from(_questions)) {
	// 		var node = _g('term_' + question.mask);
	// 		node.className = 'term unplaced ease';
	// 		node.removeAttribute('data-placed');
	// 		node.setAttribute('aria-label',  "Now on label: " + question.questions[0].text + ", currently unplaced");
	// 		_labelTextsByQuestionId[question.id] = '';
	// 		var node_copy = node;
	// 		node.remove();
	// 		// move term into the placed terms div
	// 		_g('unplaced-terms').appendChild(node_copy);
	// 	}


	// 	// labels, shut up!
	// 	_labelTextsByQuestionId = {};

	// 	// terms, resume default positions!
	// 	_arrangeList();

	// 	// ready to execute plan B.
	// 	_drawBoard();

	// 	// notify superiors
	// 	return _assistiveAlert("All labels have been reset.");
	// };


	// draw a dot on the specified canvas context
	// var _drawDot = function(x,y,radius,border,context,borderColor,fillColor) {
	// 	context.beginPath();
	// 	context.arc(x, y, radius, 2 * Math.PI, false);
	// 	context.fillStyle = fillColor;
	// 	context.fill();
	// 	context.lineWidth = border;
	// 	context.strokeStyle = borderColor;
	// 	return context.stroke();
	// };

	// // draw a stroked line (one big line, one smaller on top)
	// var _drawStrokedLine = function(x1,y1,x2,y2,color1,color2,context) {
	// 	if (context == null) { context = _context; }
	// 	Labeling.Draw.drawLine(context, x1 + _offsetX, y1 + _offsetY, x2 + _offsetX, y2 + _offsetY, 6, color1);
	// 	return Labeling.Draw.drawLine(context, x1 + _offsetX, y1 + _offsetY, x2 + _offsetX, y2 + _offsetY, 2, color2);
	// };

	// // render the canvas frame
	// var _drawBoard = function(mouseX,mouseY) {
	// 	// clear any lines outside of the canvas
	// 	if (mouseX == null) { mouseX = 0; }
	// 	if (mouseY == null) { mouseY = 0; }
	// 	_context.clearRect(0,0,1000,1000);

	// 	// draw the asset image
	// 	// only use shadow if its not graph paper, because
	// 	// that would look bad
	// 	if (_qset.options.backgroundTheme !== 'themeGraphPaper') {
	// 		_context.shadowOffsetX = 0;
	// 		_context.shadowOffsetY = 0;
	// 		_context.shadowBlur = 10;
	// 		_context.shadowColor = 'rgba(0,0,0,0.5)';
	// 	}

	// 	_context.drawImage(_img, _qset.options.imageX,_qset.options.imageY,(_img.width * _qset.options.imageScale), (_img.height * _qset.options.imageScale));
	// 	_context.shadowColor = '';
	// 	_context.shadowBlur = 0;

	// 	// reference the ghost object, and make it invisible
	// 	const ghost = _g('ghost');
	// 	ghost.style.opacity = 0;

	// 	return (() => {
	// 		const result = [];
	// 		for (var question of Array.from(_questions)) {
	// 		// if the question has an answer placed, draw a solid line connecting it
	// 		// but only if the label is not replacing one that already exists
	// 			var dotBackground, dotBorder;
	// 			if (_labelTextsByQuestionId[question.id] && !(_curMatch && _labelTextsByQuestionId[_curMatch.id] && (question.id === _curMatch.id))) {
	// 				_drawStrokedLine(question.options.endPointX, question.options.endPointY, question.options.labelBoxX, question.options.labelBoxY, '#fff', '#000');
	// 				dotBorder = 'rgba(255,255,255,' + _anchorOpacityValue + ')';
	// 				dotBackground = 'rgba(0,0,0,' + _anchorOpacityValue + ')';
	// 			} else {
	// 				dotBorder = 'rgba(0,0,0,' + _anchorOpacityValue + ')';
	// 				dotBackground = 'rgba(255,255,255,' + _anchorOpacityValue + ')';
	// 			}

	// 			// if the question has a match dragged near it, draw a ghost line
	// 			if ((_curMatch != null) && (_curMatch.id === question.id)) {
	// 				_drawStrokedLine(question.options.endPointX, question.options.endPointY, question.options.labelBoxX, question.options.labelBoxY, 'rgba(255,255,255,0.2)', 'rgba(0,0,0,0.3)');

	// 				dotBorder = 'rgba(255,255,255,' + _anchorOpacityValue + ')';
	// 				dotBackground = 'rgba(0,0,0,' + _anchorOpacityValue + ')';

	// 				// if the match doesn't have a label already
	// 				if (!_labelTextsByQuestionId[_curMatch.id]) {
	// 					// move the ghost label and make it semi-transparent
	// 					ghost.style.webkitTransform =
	// 					(ghost.style.msTransform =
	// 					(ghost.style.transform = 'translate(' + (question.options.labelBoxX + 205 + _offsetX + _imageXMargin()) + 'px,' + (question.options.labelBoxY + _offsetY + _imageYMargin() + 35) + 'px)'));
	// 					ghost.style.opacity = 0.5;
	// 					_g('ghost').className = 'term';
	// 				}
	// 			} else if (!_curMatch) {
	// 				_g('term_' + question.mask).style.opacity = 1;
	// 			}

	// 			result.push(_drawDot(question.options.endPointX + _offsetX,question.options.endPointY + _offsetY, 9, 3, _context, dotBorder, dotBackground));
	// 		}
	// 		return result;
	// 	})();
	// };

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

	const _submitButtonConfirm = function() {
		_hideDialogs();
		return _submitAnswersToMateria();
	};

	// hide all  dialogs
	const _hideDialogs = function() {
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

	const _showInstructions = function() {
		_prevFocus = document.activeElement;
		_g('previewbox').classList.add('show');
		_g('previewbox').removeAttribute("inert");
		_g('previewbox').setAttribute("aria-hidden", false);
		_g('gotitbtn').focus();
		_g('game').setAttribute("aria-hidden", true);
		_g('game').setAttribute("inert", true);
		return _dialogOpen = true;
	};

	const _assistiveAlert = msg => _g('assistive-alert').innerHTML = msg;

	// submit questions to Materia. Ask first if they aren't done$
	const _submitAnswers = function() {
		if (!_isPuzzleComplete) {
			return _showAlert();
		} else {
			return _submitAnswersToMateria();
		}
	};

	// submit every question and the placed answer to Materia for scoring
	const _submitAnswersToMateria = function() {
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
