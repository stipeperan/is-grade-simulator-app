# IS Grade Simulator

A private full-stack React app for exploring Information Security course grades.

## What It Does

- Enter all quiz scores in editable cells.
- Enter the midterm score using the fixed rescaled denominator `85`.
- See possible final-exam outcomes from `0%` to `100%`.
- See the final-exam percentage needed for every half grade from `1.0` to `10.0`.
- After the final exam, enter the final numerator and rescaled denominator to compute the actual grade.

## Run Locally

```bash
npm install
npm run dev
```

The React app runs through Vite, and the Express API runs on port `4174`.

## Run With Docker

```bash
docker compose up --build
```

Then open:

```text
http://localhost:4174
```

To stop it:

```bash
docker compose down
```

If port `4174` is already busy, choose another host port:

```bash
HOST_PORT=4180 docker compose up --build
```

Then open `http://localhost:4180`.

## Build

```bash
npm run build
npm start
```
