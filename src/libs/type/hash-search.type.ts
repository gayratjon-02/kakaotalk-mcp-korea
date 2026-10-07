export type HashSearchJob = {
	target: string;
	start: number;
	step: number;
	max: number;
};

export type HashSearchMessage = {
	type: 'progress' | 'done';
	value: number | null;
};
