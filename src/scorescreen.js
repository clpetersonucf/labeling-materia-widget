Namespace('Labeling').ScoreCore = (function() {
	
	let _qset = null;
	let _questions = null
	let _qDiv = null
	let _pairTemp = null

	// the image asset
	let _img = null;

	let _svg = null;
	let _defs = null;

	// anchor tag opacity
	let _anchorOpacityValue = 1.0;

	// legacy support; older qsets are relative to window
	let _offsetX = 0;
	let _offsetY = 0;

	const _getRenderedHeight = () => {
		return Math.ceil(parseFloat(window.getComputedStyle(document.querySelector('html')).height)) - 21;
	}

	const _distance = (x1, y1, x2, y2) => {
		return Math.sqrt(((x1-x2)**2) + ((y1-y2)**2))
	}

	const start = (instance, qset, scoreTable, isPreview, qsetVersion) => {
		_qset = qset
		_questions = _qset.items;
		_qDiv = document.getElementById("questions")
		_pairTemp = document.getElementById("template-pair")

		window.addEventListener("resize", ()=>Materia.ScoreCore.setHeight(_getRenderedHeight()))

		console.log(_questions)

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
		document.getElementById('board').style.background = background;
		
		_svg = document.getElementById("svglayer")
		_defs = document.getElementById("defs")
		// load the image asset
		// when done, render the board
		_img = document.getElementById("imgsrc")
		// _img.onload = _drawBoard;

		_img.src = Materia.ScoreCore.getMediaUrl((
			_qset.options.image ? _qset.options.image.id : _qset.assets[0]));
		_img.alt = _qset.options.image && _qset.options.image.alt ? _qset.options.image.alt : "No description provided. Please contact author of this widget for an image description.";

		for (let i = 0; i < _questions.length; i++) {
			let question = _questions[i]
			let scoreEntry = scoreTable[i]

			if (!question.id) {
				question.id = 'q'+Math.random();
			}

			console.log(question.questions[0].text, scoreEntry)

			question.mask = 'm'+Math.random();
			const isPlaced = scoreEntry.data[0] != ""
			const correct = scoreEntry.score > 0

			// Some legacy qsets store these as strings, which we certainly don't want
			question.options.endPointX = parseInt(question.options.endPointX);
			question.options.endPointY = parseInt(question.options.endPointY);
			question.options.labelBoxX = parseInt(question.options.labelBoxX);
			question.options.labelBoxY = parseInt(question.options.labelBoxY);

			let ghost = document.createElement('div');
			ghost.id = "ghost_"+question.mask
			ghost.className = `term final placed ${!isPlaced && "target"}`
			ghost.innerHTML = isPlaced ? scoreEntry.data[0] : "No Answer";
			ghost.style.left = question.options.labelBoxX+"px"
			ghost.style.top = question.options.labelBoxY+"px"
			ghost.setAttribute('draggable', false)
			ghost.setAttribute('alt', question.options.description)
			ghost.setAttribute('data-i', `#${i+1}`)
			ghost.setAttribute('tabIndex', 0)
			ghost.setAttribute("aria-label", `Question ${i+1}: ${correct ? "Correct" : "Incorrect"}. You chose ${isPlaced ? scoreEntry.data[0] : "no option"}.${!correct ? ` Answer was ${scoreEntry.data[1]}.` : ""} Description: ${question.options.description}`)
			
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
			line.classList.add("placed")
			line.setAttribute("x1", x1)
			line.setAttribute("y1", y1 - 8)
			line.setAttribute("x2", x2)
			line.setAttribute("y2", y2)
			line.setAttribute("stroke", `url(#${grad.id})`)

			_svg.appendChild(line)

			
			let bullet = document.createElementNS("http://www.w3.org/2000/svg", "circle")
			bullet.id = "bullet_"+question.mask
			bullet.classList.add("bullet")
			if(correct) bullet.classList.add("correct")
			else bullet.classList.add("wrong")
			bullet.setAttribute("cx", x1)
			bullet.setAttribute("cy", y1 - 8)
			bullet.setAttribute("r", 10)

			_svg.appendChild(bullet)

			let core = document.createElementNS("http://www.w3.org/2000/svg", "image")
			core.id = "core_"+question.mask
			core.classList.add("core")
			core.style.display = "block"
			core.setAttribute("x", x1 - 8)
			core.setAttribute("y", y1 - 16)
			core.setAttribute("width", 16)
			core.setAttribute("height", 16)
			core.setAttribute("href", correct ? "assets/check.svg" : "assets/x.svg")

			_svg.appendChild(core)

			//////////////////////////

			const clone = document.importNode(_pairTemp.content, true)
			const header = clone.querySelector("h2")
			header.innerHTML = `Question #${i+1}`

			const rowLabels = clone.querySelector(".qrow").querySelectorAll("div")
			rowLabels[0].innerHTML = isPlaced ? scoreEntry.data[0] : "No Answer"
			rowLabels[0].classList.add(correct ? "correct" : "wrong")
			if(!isPlaced) rowLabels[0].classList.add("target")
			rowLabels[1].innerHTML = scoreEntry.data[1]

			_qDiv.appendChild(clone)
		}

		Materia.ScoreCore.setHeight(_getRenderedHeight());
	}

	const update = (qset, scoreTable) => {
	
	}

	return {
		start, update
	}
})();
