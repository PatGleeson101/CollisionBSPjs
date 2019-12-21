//Oct tree mockup with three.js

//Canvas setup
var SCREEN_WIDTH = document.body.clientWidth - 40;
var SCREEN_HEIGHT = window.innerHeight - 10;
const canvas = document.getElementById('c');
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

//renderer
var renderer = new THREE.WebGLRenderer({canvas});

//scene
var scene = new THREE.Scene();
var axesHelper = new THREE.AxesHelper( 2000 );
scene.add( axesHelper );

//camera
var camera = new THREE.PerspectiveCamera( 90, SCREEN_WIDTH/SCREEN_HEIGHT, 1, 10000 );
var vFOV = camera.fov * (Math.PI / 180);

camera.position.z = SCREEN_HEIGHT / (2 * Math.tan(vFOV / 2) );
camera.position.y = 200;
camera.lookAt(scene.position)
camera.rotation.order = "YXZ";

camera.position.x = 1100;
camera.position.y = 1100;
camera.position.z = 1100;
camera.lookAt(scene.position)

//Add 2 lights
{
  const color = 0xFFFFFF;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(0, 200, -400);
  scene.add(light);
}

{
  const color = 0xFFFFFF;
  const intensity = 0.7;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(0, 200, 400);
  scene.add(light);
}

//Object class
class SceneObject {
	constructor(pos, size) {
		this.pos = pos;
		this.size = size;
		const bboxMax = [this.pos[0] + this.size[0], this.pos[1] + this.size[1], this.pos[2] + this.size[2]];
		this.bbox = {min: this.pos, max: bboxMax};

		//Create three.js representation
		const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
		const material = new THREE.MeshPhongMaterial( {color: 0x00ff00} );
		const box = new THREE.Mesh( geometry, material );
		box.position.set(pos[0], pos[1], pos[2]);
		this.box = box;
	}
}

//Oct-tree
class BoxRegion {
	constructor(parent, pos, size, objectLimit = 3) {
		this.parent = parent;
		this.pos = pos;
		this.size = size;
		this.splitType = (parent.splitType + 1)%3; //Class n BoxRegion will split about axis n 
		this.splitPoint = this.pos[this.splitType] + this.size[this.splitType]/2;
		this.subRegions = Array(2);
		this.isSplit = false;
		this.wasSplit = false;
		this.totalObjectCount = 0;
		this.ownObjectCount = 0;
		this.objectLimit = objectLimit;
		this.ownObjects = [];

		//Create three.js representation
		const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
		const edges = new THREE.EdgesGeometry( geometry );
		const line = new THREE.LineSegments( edges );
		line.position.set(pos[0] + size[0]/2, pos[1] + size[1]/2, pos[2] + size[2]/2);
		//line.material.depthTest = false;
		line.material.opacity = 0.1;
		line.material.transparent = true;
		let stringArr = ["00","00","00"];
		stringArr[this.splitType] = "ff";
		line.material.color = new THREE.Color(parseInt("0x"+stringArr.join('')));
		this.box = line;
		scene.add(line);
	}

	setDefaultColour() {
		let stringArr = ["00","00","00"];
		stringArr[this.splitType] = "ff";
		this.box.material.color = new THREE.Color(parseInt("0x"+stringArr.join('')));
	}

	split() {
		//Create subRegions if it hasn't been done previously
		if (!this.wasSplit) {
			let subSize = [...this.size]; //Copy own size
			subSize[this.splitType] /= 2; //Halve appropriate axis
			let pos1 = [...this.pos];
			pos1[this.splitType] = this.splitPoint; //Position of second box
			this.subRegions[0] = new BoxRegion(this, this.pos, subSize, this.objectLimit); //Create first box
			this.subRegions[1] = new BoxRegion(this, pos1, subSize, this.objectLimit); //Create second box
		} else {
			this.subRegions[0].box.visible = true;
			this.subRegions[1].box.visible = true;
		}

		//Sort objects into subregions
		let newOwnObjects = [];
		for (let i = 0; i < this.ownObjectCount; i++) {
			const obj = this.ownObjects[i];
			const box0 = this.subRegions[0];
			const box1 = this.subRegions[1];
			if (obj.bbox.max[this.splitType] < this.splitPoint) { //Is in first box
				box0.ownObjects[box0.ownObjectCount++] = obj;
			} else if (obj.bbox.min[this.splitType] > this.splitPoint) { //Is in second box
				box1.ownObjects[box1.ownObjectCount++] = obj;
			} else { //Remains in ownObjects
				newOwnObjects.push(obj);
			}
		}

		//Replace current ownObjects data
		this.ownObjects = newOwnObjects;
		this.ownObjectCount = this.ownObjects.length;

		//Set isSplit to true
		this.isSplit = true;
		this.wasSplit = true;
	}

	unsplit() {
		if (this.isSplit) {
			const box0 = this.subRegions[0];
			const box1 = this.subRegions[1];
			if (box0.isSplit) {
				box0.unsplit();
			}
			if (box1.isSplit) {
				box1.unsplit();
			}
			this.ownObjects = this.ownObjects.concat(box0.ownObjects);
			this.ownObjectCount += box0.ownObjectCount;
			box0.ownObjects = [];
			box0.ownObjectCount = 0;
			box0.box.visible = false;
			this.ownObjects = this.ownObjects.concat(box1.ownObjects);
			this.ownObjectCount += box1.ownObjectCount;
			box1.ownObjects = [];
			box1.ownObjectCount = 0;
			box1.box.visible = false;

			this.isSplit = false;
		}
	}

	addObject(obj) {
		if (this.isSplit) {
			if (obj.bbox.max[this.splitType] < this.splitPoint) { //Is in first box
				this.subRegions[0].addObject(obj);
			} else if (obj.bbox.min[this.splitType] > this.splitPoint) { //Is in second box
				this.subRegions[1].addObject(obj);
			} else { //Remains in ownObjects
				this.ownObjects.push(obj);
				this.ownObjectCount += 1;
			}
		} else {
			if (this.ownObjectCount === this.objectLimit) {
				this.split();
				this.addObject(obj);
			} else {
				this.ownObjects.push(obj);
				this.ownObjectCount += 1;
			}
		}
		scene.add(obj.box);
	}

	getBox(x, y, z) {
		const coords = [x, y, z];
		//Check that point is indeed inside box
		for (let i = 0; i < 3; i++) {
			if ((coords[i] < this.pos[i]) || (coords[i] > this.pos[i] + this.size[i])) {
				return null;
			}
		}
		if (this.isSplit) {
			if (coords[this.splitType] > this.splitPoint) {
				return this.subRegions[1].getBox(x, y, z);
			} else {
				return this.subRegions[0].getBox(x, y, z);
			}
		} else {
			return this;
		}
	}

	getBboxCollisions(parentObjects = null) {
		let collisionPairs = [];
		let box0ToCheck = [];
		let box1ToCheck = [];

		if (parentObjects !== null) {
			const parentObjectCount = parentObjects.length;
			for (let i = 0; i < parentObjectCount; i++) {
				//Check for collisions between this box's objects and given parent objects
				const parentObj = parentObjects[i];
				const pMax = parentObj.bbox.max;
				const pMin = parentObj.bbox.min;
				for (let j = 0; j < this.ownObjectCount; j++) {
					const ownObj = this.ownObjects[j];
					const oMax = ownObj.bbox.max;
					const oMin = ownObj.bbox.min;
					if ( ((oMax[0] > pMin[0])&&(pMax[0] > oMin[0])) && ((oMax[1] > pMin[1])&&(pMax[1] > oMin[1])) && ((oMax[2] > pMin[2])&&(pMax[2] > oMin[2])) ) {
						collisionPairs.push([parentObj, ownObj]);
					}
				}
				//Decide whether this parent object could collide with objects in each child
				if (pMin[this.splitType] < this.splitPoint) {
					box0ToCheck.push(parentObj);
				}
				if (pMax[this.splitType] > this.splitPoint) {
					box1ToCheck.push(parentObj);
				}
			}
		}

		//Check for collisions in child boxes
		if (this.isSplit) {
			const box0 = this.subRegions[0];
			const box1 = this.subRegions[1];
			collisionPairs = collisionPairs.concat(box0.getBboxCollisions(box0ToCheck.concat(this.ownObjects)).concat(box1.getBboxCollisions(box1ToCheck.concat(this.ownObjects))));
		}

		//Check for collisions between own objects
		for (let i = 0; i < this.ownObjectCount; i++) {
			//Check for collisions between this box's objects and given parent objects
			const obj1 = this.ownObjects[i];
			const o1Max = obj1.bbox.max;
			const o1Min = obj1.bbox.min;
			for (let j = 0; j < i; j++) {
				const obj2 = this.ownObjects[j];
				const o2Max = obj2.bbox.max;
				const o2Min = obj2.bbox.min;
				if ( ((o2Max[0] > o1Min[0])&&(o1Max[0] > o2Min[0])) && ((o2Max[1] > o1Min[1])&&(o1Max[1] > o2Min[1])) && ((o2Max[2] > o1Min[2])&&(o1Max[2] > o2Min[2])) ) {
					collisionPairs.push([obj1, obj2]);
				}
			}
		}

		return collisionPairs;
	}
}

const worldSize = 1000;
const world = new BoxRegion({splitType: 2}, [0,0,0], [worldSize, worldSize, worldSize], 10);

var allObjects = [];
for (let i = 0; i < 2000; i++) {
	const obj = new SceneObject([(Math.random()**3)*worldSize, (Math.random()**3)*worldSize, (Math.random()**3)*worldSize], [5, 5, 5]);
	world.addObject(obj);
	allObjects.push(obj);
}

//Keyhandling
var keyStates = {};
window.onkeydown = function(e) {
  keyStates[e.key] = true;
}
window.onkeyup = function(e) {
  keyStates[e.key] = false;
}

window.addEventListener('resize', function() {
      var WIDTH = window.innerWidth,
          HEIGHT = window.innerHeight;
      renderer.setSize(WIDTH, HEIGHT);
      camera.aspect = WIDTH / HEIGHT;
  
      var vFOV = camera.fov * (Math.PI / 180) // convert VERTICAL fov to radians
      //camera.position.z = window.innerHeight / (2 * Math.tan(vFOV / 2) );
  
      camera.updateProjectionMatrix();

    });

//Rendering
var currentBox = null;
function render() {
 requestAnimationFrame( render );
 //Highlight box
 if (currentBox != null) {
 	currentBox.setDefaultColour();
 }
 
 if (keyStates["q"]) {
	 for (let i = 0; i < allObjects.length; i++) {
	 	allObjects[i].box.visible = false;
	 }
	 currentBox = world.getBox(camera.position.x, camera.position.y, camera.position.z);
	 if (currentBox != null) {
	 	currentBox.box.material.color.setHex(0xffffff);
	 	let parentBox = currentBox;
	 	while (parentBox instanceof BoxRegion ) {
	 		for (let i = 0; i < parentBox.ownObjectCount; i++) {
	 			parentBox.ownObjects[i].box.visible = true;
	 		}
	 		parentBox = parentBox.parent;
	 	}
	 }
 } else {
 	for (let i = 0; i < allObjects.length; i++) {
	 	allObjects[i].box.visible = true;
	 }
 }

 if (keyStates["e"]) {
 	for (let i = 0; i < allObjects.length; i++) {
	 	allObjects[i].box.material.color.setHex(0x00ff00);
	 }
 	const bboxCollisions = world.getBboxCollisions();
	for (let i = 0; i < bboxCollisions.length; i++) {
		const pair = bboxCollisions[i];
		pair[0].box.material.color.setHex(0xff0000);
		pair[1].box.material.color.setHex(0xff0000);
	}
 } else {
 	for (let i = 0; i < allObjects.length; i++) {
	 	allObjects[i].box.material.color.setHex(0x00ff00);
	 }
 }

   //Check for movement
   if (keyStates['w']) {
    camera.translateZ(-8);
   }
   if (keyStates['s']) {
    camera.translateZ(8);
   }
   if (keyStates['a']) {
    camera.translateX(-8);
   }
   if (keyStates['d']) {
    camera.translateX(8);
   }
   if (keyStates[' ']) {
    camera.position.y += (8);
   }
   if (keyStates['Shift']) {
    camera.position.y += (-8);
   }

   //Check for camera rotation
   if (keyStates['ArrowUp']) {
    camera.rotation.x += 0.025;
   }
   if (keyStates['ArrowDown']) {
    camera.rotation.x -= 0.025;
   }
   if (keyStates['ArrowLeft']) {
    camera.rotation.y += 0.025;
   }
   if (keyStates['ArrowRight']) {
    camera.rotation.y -= 0.025;
   }
   renderer.render( scene, camera );
}

render();

function instructions() {
	alert("WASD to move.\nArrows to look around.\nQ to show the objects that the program would check you against for collisions.\nE to highlight collisions in real time.\nA practical, non-optimised demonstration of collision detection with space partitioning (2000 objects).\nGraphics done with three.js.\nMade by Patrick Gleeson.")
}
setTimeout(instructions, 800);


