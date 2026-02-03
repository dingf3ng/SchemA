# T
```ocaml
struct Stack<T>
  (* Data Aggregation *)
  { 
		data arr: Array<T> = [] (* Note the enforcement of type annotation in Data Aggregation *)
    (* This is important to information hiding because we want to infer the type parameters of Stack, instead of it's data. So we want to establish the connection between data's types and the type parameters of Stack. So when arr is fixed in array<int>, we know type parameter T is int *)
		data length: int = 0
	}
  (* Behaviors *)
	{
		do push(val) { (* For functions, they are inferred again *)
			arr.push(val) (* arr is infered by the type of val *)
		}
		do pop() {
			length -= 1
			return arr.pop() 
		}
		do peek() {
			return arr[length - 1]
		}
		do length() {
			return length
		}
	}

let myStack = Stack()
(* typeof(myStack) == "Stack<weak>" *)
myStack.push(1)
(* typeof(myStack) == "Stack<int>" *)
myStack.push("a")
(* static type error because the typeof the stack is assoc to int *)
```
