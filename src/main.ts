import { mount } from "svelte"
import "./app.css"
import Root from "./Root.svelte"

const target = document.getElementById("app")

if (!target) {
	throw new Error("Missing #app mount node")
}

export default mount(Root, { target })
