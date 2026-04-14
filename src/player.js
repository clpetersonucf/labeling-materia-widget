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

	let _nextAlert = ""

	const _pushAlert = (a) => {
		_nextAlert = a
	}

	const _popAlert = () => {
		_assistiveAlert(_nextAlert)
		_nextAlert = ""
	}
	
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

		_g('keyboard-sel').addEventListener("click", (e) => {
			e.target.classList.add("selected")
			_g('pointer-sel').classList.remove("selected")

			_g('pointer_instructions').classList.add("hidden")
			_g('keyboard_instructions').classList.remove("hidden")
		})

		_g('pointer-sel').addEventListener("click", (e) => {
			e.target.classList.add("selected")
			_g('keyboard-sel').classList.remove("selected")

			_g('keyboard_instructions').classList.add("hidden")
			_g('pointer_instructions').classList.remove("hidden")
		})

		_svg = document.getElementById("svglayer")
		_defs = document.getElementById("defs")
		// load the image asset
		// when done, render the board
		_img = document.getElementById("imgsrc")
		// _img.onload = _drawBoard;

		_img.src = Materia.Engine.getImageAssetUrl((
			_qset.options.image ? _qset.options.image.id : _qset.assets[0]));
		_img.alt = _qset.options.image && _qset.options.image.alt ? _qset.options.image.alt : "No description provided. Please contact author of this widget for an image description.";
		
		_img.style.marginLeft = _qset.options.imageX+"px"
		_img.style.marginTop = _qset.options.imageY+"px"
		_img.style.width = (605 * _qset.options.imageScale) + "px"
		_img.style.height = (550 * _qset.options.imageScale) + "px"
		// _canvas.setAttribute('aria-label', _qset.options.image && _qset.options.image.alt ? _qset.options.image.alt : "No description provided. Please contact author of this widget for an image description.");
		
		// store sidebar terms to be added later
		let addTerms = []
	
		// create term divs
		let termNum = 0
		for (var question of Array.from(_questions)) {
			if (!question.id) {
				question.id = 'q'+Math.random();
			}

			termNum++;

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
			ghost.setAttribute('alt', question.options.description)
			ghost.setAttribute('data-i', termNum)
			ghost.addEventListener("dragstart", (e) => {
				_isDragging = true
				// setTimeout(()=>e.target.classList.add("empty"), 10)
			})
			ghost.addEventListener("drag", _dragWhileHandler)
			ghost.addEventListener("dragend", _dragEndHandler)
			ghost.addEventListener("mouseup", _mouseUpEvent)
			ghost.addEventListener("keydown", _termKeyHandler)
			ghost.addEventListener('focus', _termFocus);
			ghost.addEventListener('blur', _termBlur);

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
			line.setAttribute("y1", y1)
			line.setAttribute("x2", x2)
			line.setAttribute("y2", y2)
			line.setAttribute("stroke", `url(#${grad.id})`)

			_svg.appendChild(line)

			
			let bullet = document.createElementNS("http://www.w3.org/2000/svg", "circle")
			bullet.id = "bullet_"+question.mask
			bullet.classList.add("bullet")
			bullet.setAttribute("cx", x1)
			bullet.setAttribute("cy", y1)
			bullet.setAttribute("r", 8)

			_svg.appendChild(bullet)

			let core = document.createElementNS("http://www.w3.org/2000/svg", "circle")
			core.id = "core_"+question.mask
			core.classList.add("core")
			core.style.display = "none"
			core.setAttribute("cx", x1)
			core.setAttribute("cy", y1)
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

		// let labelStatus = _curSelectSource.className.includes("final") ? "placed" : "unplaced"
		// _curSelectSource.setAttribute("aria-label", `Selected ${labelStatus} label: ${_curSelectSource.innerHTML}. You may now select a destination.`)
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

		let ariaString = `Placing: Destination ${_curSelectTarget.getAttribute("data-i")} is currently empty. Description: ${_curSelectTarget.getAttribute("alt")}`
		if(_curSelectTarget.innerHTML != "")
			ariaString = `Placing: Destination ${_curSelectTarget.getAttribute("data-i")} currently contains: ${_curSelectTarget.innerHTML}. Description: ${_curSelectTarget.getAttribute("alt")}`
		
		_assistiveAlert(ariaString)
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
			v.setAttribute("aria-label", "")

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
		v.setAttribute("aria-label", `Now on label: ${data}. Placed at destination ${v.getAttribute("data-i")}.`)

		// set ghost state
		v.classList.remove("ghost")
		v.classList.add("placed")
		v.setAttribute("draggable", true)
		v.setAttribute("data-label_id", sourceId)
		v.setAttribute("tabindex", 0)

		// set svg graphic state
		document.getElementById(v.id.replace("ghost","core")).style.display = "block"
		document.getElementById(v.id.replace("ghost","line")).classList.add("placed")

		_pushAlert(`Label "${data}" has been placed at destination ${v.getAttribute("data-i")}.`)

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
					_pushAlert(`Reset label "${_curFocus.innerHTML}".`)
					_animateResetGhost(_curFocus)
					// update term headers
					
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
				// offsets each reset by 75ms
				setTimeout(()=>requestAnimationFrame(()=>_animateResetGhost(v)), count*75)
				count++
			}
		})

		_assistiveAlert("All labels have been reset.")
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

		const numFilled = document.querySelectorAll('.term.final.placed').length;
		if (numFilled === _questions.length) {
			_g('unplaced-header').setAttribute('aria-label', "No unplaced labels. All labels have been placed.");
			_pushAlert("Placed all labels. Submit your answers to see your score.");
		} else if (numFilled > 0) {
			_g('placed-header').setAttribute('aria-label', "Placed labels. There are " + numFilled + " labels placed.");
			_g('unplaced-header').setAttribute('aria-label', "Unplaced labels. There are " + (_questions.length - numFilled) + " labels remaining.");
		}

		_popAlert()
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
		_dialogOpen = true;
	};

	const _submitButtonConfirm = function() {
		_hideDialogs();
		_submitAnswersToMateria();
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
			_prevFocus.focus();
		} else {
			_g('instructionsBtn').focus();
		}
	};

	const _showInstructions = function() {
		_prevFocus = document.activeElement;
		_g('game').setAttribute("aria-hidden", true);
		_g('game').setAttribute("inert", true);
		_g('previewbox').classList.add('show');
		_g('previewbox').removeAttribute("inert");
		_g('previewbox').setAttribute("aria-hidden", false);
		_g('backgroundcover').classList.add('show');
		_g('gotitbtn').focus();
		_dialogOpen = true;
	};

	const _assistiveAlert = msg => _g('assistive-alert').innerHTML = msg;

	// submit questions to Materia. Ask first if they aren't done$
	const _submitAnswers = function() {
		if (!_isPuzzleComplete) {
			_showAlert();
		} else {
			_submitAnswersToMateria();
		}
	};

	// submit every question and the placed answer to Materia for scoring
	const _submitAnswersToMateria = function() {
		for (var question of Array.from(_questions)) {
			Materia.Score.submitQuestionForScoring(question.id, _labelTextsByQuestionId[question.id]);
		}
		Materia.Engine.end();
	};

	//public
	return {
		manualResize: true,
		start
	};
})();
